/**
 * @author Eltik. Credit to CORS proxy by Rob Wu.
 * @description Proxies m3u8 files.
 * @license MIT
 */

import dotenv from "dotenv";
dotenv.config();

import httpProxy from "http-proxy";
import https from "node:https";
import http, { Server } from "node:http";
import net from "node:net";
import url from "node:url";
import { getProxyForUrl } from "proxy-from-env";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import colors from "colors";
import axios from "axios";

// Enhanced logging utility
const logger = {
    debug: (message: string, data?: any) => {
        console.log(colors.cyan(`[DEBUG ${new Date().toISOString()}]`), message, data ? JSON.stringify(data, null, 2) : '');
    },
    info: (message: string, data?: any) => {
        console.log(colors.blue(`[INFO ${new Date().toISOString()}]`), message, data ? JSON.stringify(data, null, 2) : '');
    },
    warn: (message: string, data?: any) => {
        console.warn(colors.yellow(`[WARN ${new Date().toISOString()}]`), message, data ? JSON.stringify(data, null, 2) : '');
    },
    error: (message: string, error?: any) => {
        console.error(colors.red(`[ERROR ${new Date().toISOString()}]`), message);
        if (error) {
            if (error.stack) {
                console.error(colors.red('Stack trace:'), error.stack);
            } else {
                console.error(colors.red('Error details:'), JSON.stringify(error, null, 2));
            }
        }
    }
};

function withCORS(headers, request) {
    headers["access-control-allow-origin"] = "*";
    const corsMaxAge = request.corsAnywhereRequestState.corsMaxAge;
    if (request.method === "OPTIONS" && corsMaxAge) {
        headers["access-control-max-age"] = corsMaxAge;
    }
    if (request.headers["access-control-request-method"]) {
        headers["access-control-allow-methods"] = request.headers["access-control-request-method"];
        delete request.headers["access-control-request-method"];
    }
    if (request.headers["access-control-request-headers"]) {
        headers["access-control-allow-headers"] = request.headers["access-control-request-headers"];
        delete request.headers["access-control-request-headers"];
    }

    headers["access-control-expose-headers"] = Object.keys(headers).join(",");

    return headers;
}

function proxyRequest(req, res, proxy) {
    const location = req.corsAnywhereRequestState.location;
    logger.debug('Starting proxy request', {
        originalUrl: req.url,
        targetLocation: location.href,
        method: req.method,
        headers: req.headers
    });
    
    req.url = location.path;

    const proxyOptions = {
        changeOrigin: false,
        prependPath: false,
        target: location,
        headers: {
            host: location.host,
        },
        // HACK: Get hold of the proxyReq object, because we need it later.
        // https://github.com/nodejitsu/node-http-proxy/blob/v1.11.1/lib/http-proxy/passes/web-incoming.js#L144
        buffer: {
            pipe: function (proxyReq) {
                const proxyReqOn = proxyReq.on;
                // Intercepts the handler that connects proxyRes to res.
                // https://github.com/nodejitsu/node-http-proxy/blob/v1.11.1/lib/http-proxy/passes/web-incoming.js#L146-L158
                proxyReq.on = function (eventName, listener) {
                    if (eventName !== "response") {
                        return proxyReqOn.call(this, eventName, listener);
                    }
                    return proxyReqOn.call(this, "response", function (proxyRes) {
                        if (onProxyResponse(proxy, proxyReq, proxyRes, req, res)) {
                            try {
                                listener(proxyRes);
                            } catch (err) {
                                // Wrap in try-catch because an error could occur:
                                // "RangeError: Invalid status code: 0"
                                // https://github.com/Rob--W/cors-anywhere/issues/95
                                // https://github.com/nodejitsu/node-http-proxy/issues/1080
                                logger.error('Error in proxy response handler', {
                                    error: err,
                                    url: location.href,
                                    method: req.method
                                });

                                // Forward error (will ultimately emit the 'error' event on our proxy object):
                                // https://github.com/nodejitsu/node-http-proxy/blob/v1.11.1/lib/http-proxy/passes/web-incoming.js#L134
                                proxyReq.emit("error", err);
                            }
                        }
                    });
                };
                return req.pipe(proxyReq);
            },
        },
    };

    const proxyThroughUrl = req.corsAnywhereRequestState.getProxyForUrl(location.href);
    if (proxyThroughUrl) {
        proxyOptions.target = proxyThroughUrl;
        (proxyOptions as any).toProxy = true;
        // If a proxy URL was set, req.url must be an absolute URL. Then the request will not be sent
        // directly to the proxied URL, but through another proxy.
        req.url = location.href;
    }

    // Start proxying the request
    try {
        logger.debug('Initiating proxy web request', {
            target: proxyOptions.target,
            url: req.url,
            proxyThroughUrl: proxyThroughUrl
        });
        proxy.web(req, res, proxyOptions);
        logger.debug('Proxy web request initiated successfully');
    } catch (err) {
        logger.error('Failed to initiate proxy web request', {
            error: err,
            target: proxyOptions.target,
            url: req.url,
            method: req.method
        });
        //proxy.emit('error', err, req, res);
    }
}

function onProxyResponse(proxy, proxyReq, proxyRes, req, res) {
    const requestState = req.corsAnywhereRequestState;

    const statusCode = proxyRes.statusCode;
    
    logger.debug('Received proxy response', {
        statusCode: statusCode,
        url: requestState.location.href,
        headers: proxyRes.headers,
        redirectCount: requestState.redirectCount_ || 0
    });

    if (!requestState.redirectCount_) {
        res.setHeader("x-request-url", requestState.location.href);
    }
    // Handle redirects
    if (statusCode === 301 || statusCode === 302 || statusCode === 303 || statusCode === 307 || statusCode === 308) {
        let locationHeader = proxyRes.headers.location;
        let parsedLocation;
        if (locationHeader) {
            locationHeader = url.resolve(requestState.location.href, locationHeader);
            parsedLocation = parseURL(locationHeader);
        }
        if (parsedLocation) {
            if (statusCode === 301 || statusCode === 302 || statusCode === 303) {
                // Exclude 307 & 308, because they are rare, and require preserving the method + request body
                requestState.redirectCount_ = requestState.redirectCount_ + 1 || 1;
                logger.info('Handling redirect', {
                    statusCode: statusCode,
                    redirectCount: requestState.redirectCount_,
                    maxRedirects: requestState.maxRedirects,
                    originalUrl: requestState.location.href,
                    redirectUrl: locationHeader
                });
                if (requestState.redirectCount_ <= requestState.maxRedirects) {
                    // Handle redirects within the server, because some clients (e.g. Android Stock Browser)
                    // cancel redirects.
                    // Set header for debugging purposes. Do not try to parse it!
                    res.setHeader("X-CORS-Redirect-" + requestState.redirectCount_, statusCode + " " + locationHeader);

                    req.method = "GET";
                    req.headers["content-length"] = "0";
                    delete req.headers["content-type"];
                    requestState.location = parsedLocation;

                    // Remove all listeners (=reset events to initial state)
                    req.removeAllListeners();

                    // Remove the error listener so that the ECONNRESET "error" that
                    // may occur after aborting a request does not propagate to res.
                    // https://github.com/nodejitsu/node-http-proxy/blob/v1.11.1/lib/http-proxy/passes/web-incoming.js#L134
                    proxyReq.removeAllListeners("error");
                    proxyReq.once("error", function catchAndIgnoreError() {});
                    proxyReq.abort();

                    // Initiate a new proxy request.
                    logger.debug('Initiating new proxy request for redirect');
                    proxyRequest(req, res, proxy);
                    return false;
                } else {
                    logger.warn('Redirect limit exceeded', {
                        redirectCount: requestState.redirectCount_,
                        maxRedirects: requestState.maxRedirects,
                        url: requestState.location.href
                    });
                }
            }
            proxyRes.headers.location = requestState.proxyBaseUrl + "/" + locationHeader;
            logger.debug('Updated redirect location header', {
                originalLocation: locationHeader,
                newLocation: proxyRes.headers.location
            });
        }
    }

    // Strip cookies
    delete proxyRes.headers["set-cookie"];
    delete proxyRes.headers["set-cookie2"];

    proxyRes.headers["x-final-url"] = requestState.location.href;
    withCORS(proxyRes.headers, req);
    return true;
}

function parseURL(req_url) {
    const match = req_url.match(/^(?:(https?:)?\/\/)?(([^\/?]+?)(?::(\d{0,5})(?=[\/?]|$))?)([\/?][\S\s]*|$)/i);
    //                              ^^^^^^^          ^^^^^^^^      ^^^^^^^                ^^^^^^^^^^^^
    //                            1:protocol       3:hostname     4:port                 5:path + query string
    //                                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
    //                                            2:host
    if (!match) {
        return null;
    }
    if (!match[1]) {
        if (/^https?:/i.test(req_url)) {
            // The pattern at top could mistakenly parse "http:///" as host="http:" and path=///.
            return null;
        }
        // Scheme is omitted.
        if (req_url.lastIndexOf("//", 0) === -1) {
            // "//" is omitted.
            req_url = "//" + req_url;
        }
        req_url = (match[4] === "443" ? "https:" : "http:") + req_url;
    }
    const parsed = url.parse(req_url);
    if (!parsed.hostname) {
        // "http://:1/" and "http:/notenoughslashes" could end up here.
        return null;
    }
    return parsed;
}

function getHandler(options, proxy) {
    const corsAnywhere = {
        handleInitialRequest: null, // Function that may handle the request instead, by returning a truthy value.
        getProxyForUrl: getProxyForUrl, // Function that specifies the proxy to use
        maxRedirects: 5, // Maximum number of redirects to be followed.
        originBlacklist: [], // Requests from these origins will be blocked.
        originWhitelist: [], // If non-empty, requests not from an origin in this list will be blocked.
        checkRateLimit: null, // Function that may enforce a rate-limit by returning a non-empty string.
        redirectSameOrigin: false, // Redirect the client to the requested URL for same-origin requests.
        requireHeader: null, // Require a header to be set?
        removeHeaders: [], // Strip these request headers.
        setHeaders: {}, // Set these request headers.
        corsMaxAge: 0, // If set, an Access-Control-Max-Age header with this value (in seconds) will be added.
    };

    Object.keys(corsAnywhere).forEach(function (option) {
        if (Object.prototype.hasOwnProperty.call(options, option)) {
            corsAnywhere[option] = options[option];
        }
    });

    // Convert corsAnywhere.requireHeader to an array of lowercase header names, or null.
    if (corsAnywhere.requireHeader) {
        if (typeof corsAnywhere.requireHeader === "string") {
            (corsAnywhere as any).requireHeader = [(corsAnywhere as any).requireHeader.toLowerCase()];
        } else if (!Array.isArray(corsAnywhere.requireHeader) || (corsAnywhere as any).requireHeader.length === 0) {
            corsAnywhere.requireHeader = null;
        } else {
            corsAnywhere.requireHeader = (corsAnywhere.requireHeader as any).map(function (headerName) {
                return headerName.toLowerCase();
            });
        }
    }
    const hasRequiredHeaders = function (headers) {
        return (
            !corsAnywhere.requireHeader ||
            (corsAnywhere.requireHeader as any).some(function (headerName) {
                return Object.hasOwnProperty.call(headers, headerName);
            })
        );
    };

    return function (req, res) {
        const requestId = Math.random().toString(36).substr(2, 9);
        logger.info('Incoming request', {
            requestId: requestId,
            method: req.method,
            url: req.url,
            origin: req.headers.origin,
            userAgent: req.headers['user-agent'],
            remoteAddress: req.connection.remoteAddress
        });
        
        req.corsAnywhereRequestState = {
            getProxyForUrl: corsAnywhere.getProxyForUrl,
            maxRedirects: corsAnywhere.maxRedirects,
            corsMaxAge: corsAnywhere.corsMaxAge,
            requestId: requestId
        };

        const cors_headers = withCORS({}, req);
        if (req.method === "OPTIONS") {
            // Pre-flight request. Reply successfully:
            logger.debug('Handling OPTIONS preflight request', { requestId: requestId });
            res.writeHead(200, cors_headers);
            res.end();
            return;
        }

        const location = parseURL(req.url.slice(1));

        if (corsAnywhere.handleInitialRequest && (corsAnywhere as any).handleInitialRequest(req, res, location)) {
            return;
        }

        if (!location) {
            // Special case http:/notenoughslashes, because new users of the library frequently make the
            // mistake of putting this application behind a server/router that normalizes the URL.
            // See https://github.com/Rob--W/cors-anywhere/issues/238#issuecomment-629638853
            if (/^\/https?:\/[^/]/i.test(req.url)) {
                logger.warn('Invalid URL format - missing slash', {
                    requestId: req.corsAnywhereRequestState.requestId,
                    url: req.url
                });
                res.writeHead(400, "Missing slash", cors_headers);
                res.end("The URL is invalid: two slashes are needed after the http(s):.");
                return;
            }
            // Invalid API call. Show how to correctly use the API
            logger.debug('Serving index.html for invalid API call', {
                requestId: req.corsAnywhereRequestState.requestId,
                url: req.url
            });
            res.end(readFileSync(join(__dirname, "../index.html")));
            return;
        }

        if (location.host === "iscorsneeded") {
            // Is CORS needed? This path is provided so that API consumers can test whether it's necessary
            // to use CORS. The server's reply is always No, because if they can read it, then CORS headers
            // are not necessary.
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("no");
            return;
        }

        if ((Number(location.port) ?? 0) > 65535) {
            // Port is higher than 65535
            res.writeHead(400, "Invalid port", cors_headers);
            res.end("Port number too large: " + location.port);
            return;
        }

        function isValidHostName(hostname) {
            const regexp =
                /\.(?:AAA|AARP|ABARTH|ABB|ABBOTT|ABBVIE|ABC|ABLE|ABOGADO|ABUDHABI|AC|ACADEMY|ACCENTURE|ACCOUNTANT|ACCOUNTANTS|ACO|ACTOR|AD|ADAC|ADS|ADULT|AE|AEG|AERO|AETNA|AF|AFAMILYCOMPANY|AFL|AFRICA|AG|AGAKHAN|AGENCY|AI|AIG|AIRBUS|AIRFORCE|AIRTEL|AKDN|AL|ALFAROMEO|ALIBABA|ALIPAY|ALLFINANZ|ALLSTATE|ALLY|ALSACE|ALSTOM|AM|AMAZON|AMERICANEXPRESS|AMERICANFAMILY|AMEX|AMFAM|AMICA|AMSTERDAM|ANALYTICS|ANDROID|ANQUAN|ANZ|AO|AOL|APARTMENTS|APP|APPLE|AQ|AQUARELLE|AR|ARAB|ARAMCO|ARCHI|ARMY|ARPA|ART|ARTE|AS|ASDA|ASIA|ASSOCIATES|AT|ATHLETA|ATTORNEY|AU|AUCTION|AUDI|AUDIBLE|AUDIO|AUSPOST|AUTHOR|AUTO|AUTOS|AVIANCA|AW|AWS|AX|AXA|AZ|AZURE|BA|BABY|BAIDU|BANAMEX|BANANAREPUBLIC|BAND|BANK|BAR|BARCELONA|BARCLAYCARD|BARCLAYS|BAREFOOT|BARGAINS|BASEBALL|BASKETBALL|BAUHAUS|BAYERN|BB|BBC|BBT|BBVA|BCG|BCN|BD|BE|BEATS|BEAUTY|BEER|BENTLEY|BERLIN|BEST|BESTBUY|BET|BF|BG|BH|BHARTI|BI|BIBLE|BID|BIKE|BING|BINGO|BIO|BIZ|BJ|BLACK|BLACKFRIDAY|BLOCKBUSTER|BLOG|BLOOMBERG|BLUE|BM|BMS|BMW|BN|BNPPARIBAS|BO|BOATS|BOEHRINGER|BOFA|BOM|BOND|BOO|BOOK|BOOKING|BOSCH|BOSTIK|BOSTON|BOT|BOUTIQUE|BOX|BR|BRADESCO|BRIDGESTONE|BROADWAY|BROKER|BROTHER|BRUSSELS|BS|BT|BUDAPEST|BUGATTI|BUILD|BUILDERS|BUSINESS|BUY|BUZZ|BV|BW|BY|BZ|BZH|CA|CAB|CAFE|CAL|CALL|CALVINKLEIN|CAM|CAMERA|CAMP|CANCERRESEARCH|CANON|CAPETOWN|CAPITAL|CAPITALONE|CAR|CARAVAN|CARDS|CARE|CAREER|CAREERS|CARS|CASA|CASE|CASH|CASINO|CAT|CATERING|CATHOLIC|CBA|CBN|CBRE|CBS|CC|CD|CENTER|CEO|CERN|CF|CFA|CFD|CG|CH|CHANEL|CHANNEL|CHARITY|CHASE|CHAT|CHEAP|CHINTAI|CHRISTMAS|CHROME|CHURCH|CI|CIPRIANI|CIRCLE|CISCO|CITADEL|CITI|CITIC|CITY|CITYEATS|CK|CL|CLAIMS|CLEANING|CLICK|CLINIC|CLINIQUE|CLOTHING|CLOUD|CLUB|CLUBMED|CM|CN|CO|COACH|CODES|COFFEE|COLLEGE|COLOGNE|COM|COMCAST|COMMBANK|COMMUNITY|COMPANY|COMPARE|COMPUTER|COMSEC|CONDOS|CONSTRUCTION|CONSULTING|CONTACT|CONTRACTORS|COOKING|COOKINGCHANNEL|COOL|COOP|CORSICA|COUNTRY|COUPON|COUPONS|COURSES|CPA|CR|CREDIT|CREDITCARD|CREDITUNION|CRICKET|CROWN|CRS|CRUISE|CRUISES|CSC|CU|CUISINELLA|CV|CW|CX|CY|CYMRU|CYOU|CZ|DABUR|DAD|DANCE|DATA|DATE|DATING|DATSUN|DAY|DCLK|DDS|DE|DEAL|DEALER|DEALS|DEGREE|DELIVERY|DELL|DELOITTE|DELTA|DEMOCRAT|DENTAL|DENTIST|DESI|DESIGN|DEV|DHL|DIAMONDS|DIET|DIGITAL|DIRECT|DIRECTORY|DISCOUNT|DISCOVER|DISH|DIY|DJ|DK|DM|DNP|DO|DOCS|DOCTOR|DOG|DOMAINS|DOT|DOWNLOAD|DRIVE|DTV|DUBAI|DUCK|DUNLOP|DUPONT|DURBAN|DVAG|DVR|DZ|EARTH|EAT|EC|ECO|EDEKA|EDU|EDUCATION|EE|EG|EMAIL|EMERCK|ENERGY|ENGINEER|ENGINEERING|ENTERPRISES|EPSON|EQUIPMENT|ER|ERICSSON|ERNI|ES|ESQ|ESTATE|ET|ETISALAT|EU|EUROVISION|EUS|EVENTS|EXCHANGE|EXPERT|EXPOSED|EXPRESS|EXTRASPACE|FAGE|FAIL|FAIRWINDS|FAITH|FAMILY|FAN|FANS|FARM|FARMERS|FASHION|FAST|FEDEX|FEEDBACK|FERRARI|FERRERO|FI|FIAT|FIDELITY|FIDO|FILM|FINAL|FINANCE|FINANCIAL|FIRE|FIRESTONE|FIRMDALE|FISH|FISHING|FIT|FITNESS|FJ|FK|FLICKR|FLIGHTS|FLIR|FLORIST|FLOWERS|FLY|FM|FO|FOO|FOOD|FOODNETWORK|FOOTBALL|FORD|FOREX|FORSALE|FORUM|FOUNDATION|FOX|FR|FREE|FRESENIUS|FRL|FROGANS|FRONTDOOR|FRONTIER|FTR|FUJITSU|FUJIXEROX|FUN|FUND|FURNITURE|FUTBOL|FYI|GA|GAL|GALLERY|GALLO|GALLUP|GAME|GAMES|GAP|GARDEN|GAY|GB|GBIZ|GD|GDN|GE|GEA|GENT|GENTING|GEORGE|GF|GG|GGEE|GH|GI|GIFT|GIFTS|GIVES|GIVING|GL|GLADE|GLASS|GLE|GLOBAL|GLOBO|GM|GMAIL|GMBH|GMO|GMX|GN|GODADDY|GOLD|GOLDPOINT|GOLF|GOO|GOODYEAR|GOOG|GOOGLE|GOP|GOT|GOV|GP|GQ|GR|GRAINGER|GRAPHICS|GRATIS|GREEN|GRIPE|GROCERY|GROUP|GS|GT|GU|GUARDIAN|GUCCI|GUGE|GUIDE|GUITARS|GURU|GW|GY|HAIR|HAMBURG|HANGOUT|HAUS|HBO|HDFC|HDFCBANK|HEALTH|HEALTHCARE|HELP|HELSINKI|HERE|HERMES|HGTV|HIPHOP|HISAMITSU|HITACHI|HIV|HK|HKT|HM|HN|HOCKEY|HOLDINGS|HOLIDAY|HOMEDEPOT|HOMEGOODS|HOMES|HOMESENSE|HONDA|HORSE|HOSPITAL|HOST|HOSTING|HOT|HOTELES|HOTELS|HOTMAIL|HOUSE|HOW|HR|HSBC|HT|HU|HUGHES|HYATT|HYUNDAI|IBM|ICBC|ICE|ICU|ID|IE|IEEE|IFM|IKANO|IL|IM|IMAMAT|IMDB|IMMO|IMMOBILIEN|IN|INC|INDUSTRIES|INFINITI|INFO|ING|INK|INSTITUTE|INSURANCE|INSURE|INT|INTERNATIONAL|INTUIT|INVESTMENTS|IO|IPIRANGA|IQ|IR|IRISH|IS|ISMAILI|IST|ISTANBUL|IT|ITAU|ITV|IVECO|JAGUAR|JAVA|JCB|JE|JEEP|JETZT|JEWELRY|JIO|JLL|JM|JMP|JNJ|JO|JOBS|JOBURG|JOT|JOY|JP|JPMORGAN|JPRS|JUEGOS|JUNIPER|KAUFEN|KDDI|KE|KERRYHOTELS|KERRYLOGISTICS|KERRYPROPERTIES|KFH|KG|KH|KI|KIA|KIM|KINDER|KINDLE|KITCHEN|KIWI|KM|KN|KOELN|KOMATSU|KOSHER|KP|KPMG|KPN|KR|KRD|KRED|KUOKGROUP|KW|KY|KYOTO|KZ|LA|LACAIXA|LAMBORGHINI|LAMER|LANCASTER|LANCIA|LAND|LANDROVER|LANXESS|LASALLE|LAT|LATINO|LATROBE|LAW|LAWYER|LB|LC|LDS|LEASE|LECLERC|LEFRAK|LEGAL|LEGO|LEXUS|LGBT|LI|LIDL|LIFE|LIFEINSURANCE|LIFESTYLE|LIGHTING|LIKE|LILLY|LIMITED|LIMO|LINCOLN|LINDE|LINK|LIPSY|LIVE|LIVING|LIXIL|LK|LLC|LLP|LOAN|LOANS|LOCKER|LOCUS|LOFT|LOL|LONDON|LOTTE|LOTTO|LOVE|LPL|LPLFINANCIAL|LR|LS|LT|LTD|LTDA|LU|LUNDBECK|LUXE|LUXURY|LV|LY|MA|MACYS|MADRID|MAIF|MAISON|MAKEUP|MAN|MANAGEMENT|MANGO|MAP|MARKET|MARKETING|MARKETS|MARRIOTT|MARSHALLS|MASERATI|MATTEL|MBA|MC|MCKINSEY|MD|ME|MED|MEDIA|MEET|MELBOURNE|MEME|MEMORIAL|MEN|MENU|MERCKMSD|MG|MH|MIAMI|MICROSOFT|MIL|MINI|MINT|MIT|MITSUBISHI|MK|ML|MLB|MLS|MM|MMA|MN|MO|MOBI|MOBILE|MODA|MOE|MOI|MOM|MONASH|MONEY|MONSTER|MORMON|MORTGAGE|MOSCOW|MOTO|MOTORCYCLES|MOV|MOVIE|MP|MQ|MR|MS|MSD|MT|MTN|MTR|MU|MUSEUM|MUTUAL|MV|MW|MX|MY|MZ|NA|NAB|NAGOYA|NAME|NATIONWIDE|NATURA|NAVY|NBA|NC|NE|NEC|NET|NETBANK|NETFLIX|NETWORK|NEUSTAR|NEW|NEWS|NEXT|NEXTDIRECT|NEXUS|NF|NFL|NG|NGO|NHK|NI|NICO|NIKE|NIKON|NINJA|NISSAN|NISSAY|NL|NO|NOKIA|NORTHWESTERNMUTUAL|NORTON|NOW|NOWRUZ|NOWTV|NP|NR|NRA|NRW|NTT|NU|NYC|NZ|OBI|OBSERVER|OFF|OFFICE|OKINAWA|OLAYAN|OLAYANGROUP|OLDNAVY|OLLO|OM|OMEGA|ONE|ONG|ONL|ONLINE|ONYOURSIDE|OOO|OPEN|ORACLE|ORANGE|ORG|ORGANIC|ORIGINS|OSAKA|OTSUKA|OTT|OVH|PA|PAGE|PANASONIC|PARIS|PARS|PARTNERS|PARTS|PARTY|PASSAGENS|PAY|PCCW|PE|PET|PF|PFIZER|PG|PH|PHARMACY|PHD|PHILIPS|PHONE|PHOTO|PHOTOGRAPHY|PHOTOS|PHYSIO|PICS|PICTET|PICTURES|PID|PIN|PING|PINK|PIONEER|PIZZA|PK|PL|PLACE|PLAY|PLAYSTATION|PLUMBING|PLUS|PM|PN|PNC|POHL|POKER|POLITIE|PORN|POST|PR|PRAMERICA|PRAXI|PRESS|PRIME|PRO|PROD|PRODUCTIONS|PROF|PROGRESSIVE|PROMO|PROPERTIES|PROPERTY|PROTECTION|PRU|PRUDENTIAL|PS|PT|PUB|PW|PWC|PY|QA|QPON|QUEBEC|QUEST|QVC|RACING|RADIO|RAID|RE|READ|REALESTATE|REALTOR|REALTY|RECIPES|RED|REDSTONE|REDUMBRELLA|REHAB|REISE|REISEN|REIT|RELIANCE|REN|RENT|RENTALS|REPAIR|REPORT|REPUBLICAN|REST|RESTAURANT|REVIEW|REVIEWS|REXROTH|RICH|RICHARDLI|RICOH|RIL|RIO|RIP|RMIT|RO|ROCHER|ROCKS|RODEO|ROGERS|ROOM|RS|RSVP|RU|RUGBY|RUHR|RUN|RW|RWE|RYUKYU|SA|SAARLAND|SAFE|SAFETY|SAKURA|SALE|SALON|SAMSCLUB|SAMSUNG|SANDVIK|SANDVIKCOROMANT|SANOFI|SAP|SARL|SAS|SAVE|SAXO|SB|SBI|SBS|SC|SCA|SCB|SCHAEFFLER|SCHMIDT|SCHOLARSHIPS|SCHOOL|SCHULE|SCHWARZ|SCIENCE|SCJOHNSON|SCOT|SD|SE|SEARCH|SEAT|SECURE|SECURITY|SEEK|SELECT|SENER|SERVICES|SES|SEVEN|SEW|SEX|SEXY|SFR|SG|SH|SHANGRILA|SHARP|SHAW|SHELL|SHIA|SHIKSHA|SHOES|SHOP|SHOPPING|SHOUJI|SHOW|SHOWTIME|SI|SILK|SINA|SINGLES|SITE|SJ|SK|SKI|SKIN|SKY|SKYPE|SL|SLING|SM|SMART|SMILE|SN|SNCF|SO|SOCCER|SOCIAL|SOFTBANK|SOFTWARE|SOHU|SOLAR|SOLUTIONS|SONG|SONY|SOY|SPA|SPACE|SPORT|SPOT|SPREADBETTING|SR|SRL|SS|ST|STADA|STAPLES|STAR|STATEBANK|STATEFARM|STC|STCGROUP|STOCKHOLM|STORAGE|STORE|STREAM|STUDIO|STUDY|STYLE|SU|SUCKS|SUPPLIES|SUPPLY|SUPPORT|SURF|SURGERY|SUZUKI|SV|SWATCH|SWIFTCOVER|SWISS|SX|SY|SYDNEY|SYSTEMS|SZ|TAB|TAIPEI|TALK|TAOBAO|TARGET|TATAMOTORS|TATAR|TATTOO|TAX|TAXI|TC|TCI|TD|TDK|TEAM|TECH|TECHNOLOGY|TEL|TEMASEK|TENNIS|TEVA|TF|TG|TH|THD|THEATER|THEATRE|TIAA|TICKETS|TIENDA|TIFFANY|TIPS|TIRES|TIROL|TJ|TJMAXX|TJX|TK|TKMAXX|TL|TM|TMALL|TN|TO|TODAY|TOKYO|TOOLS|TOP|TORAY|TOSHIBA|TOTAL|TOURS|TOWN|TOYOTA|TOYS|TR|TRADE|TRADING|TRAINING|TRAVEL|TRAVELCHANNEL|TRAVELERS|TRAVELERSINSURANCE|TRUST|TRV|TT|TUBE|TUI|TUNES|TUSHU|TV|TVS|TW|TZ|UA|UBANK|UBS|UG|UK|UNICOM|UNIVERSITY|UNO|UOL|UPS|US|UY|UZ|VA|VACATIONS|VANA|VANGUARD|VC|VE|VEGAS|VENTURES|VERISIGN|VERSICHERUNG|VET|VG|VI|VIAJES|VIDEO|VIG|VIKING|VILLAS|VIN|VIP|VIRGIN|VISA|VISION|VIVA|VIVO|VLAANDEREN|VN|VODKA|VOLKSWAGEN|VOLVO|VOTE|VOTING|VOTO|VOYAGE|VU|VUELOS|WALES|WALMART|WALTER|WANG|WANGGOU|WATCH|WATCHES|WEATHER|WEATHERCHANNEL|WEBCAM|WEBER|WEBSITE|WED|WEDDING|WEIBO|WEIR|WF|WHOSWHO|WIEN|WIKI|WILLIAMHILL|WIN|WINDOWS|WINE|WINNERS|WME|WOLTERSKLUWER|WOODSIDE|WORK|WORKS|WORLD|WOW|WS|WTC|WTF|XBOX|XEROX|XFINITY|XIHUAN|XIN|XN--11B4C3D|XN--1CK2E1B|XN--1QQW23A|XN--2SCRJ9C|XN--30RR7Y|XN--3BST00M|XN--3DS443G|XN--3E0B707E|XN--3HCRJ9C|XN--3OQ18VL8PN36A|XN--3PXU8K|XN--42C2D9A|XN--45BR5CYL|XN--45BRJ9C|XN--45Q11C|XN--4DBRK0CE|XN--4GBRIM|XN--54B7FTA0CC|XN--55QW42G|XN--55QX5D|XN--5SU34J936BGSG|XN--5TZM5G|XN--6FRZ82G|XN--6QQ986B3XL|XN--80ADXHKS|XN--80AO21A|XN--80AQECDR1A|XN--80ASEHDB|XN--80ASWG|XN--8Y0A063A|XN--90A3AC|XN--90AE|XN--90AIS|XN--9DBQ2A|XN--9ET52U|XN--9KRT00A|XN--B4W605FERD|XN--BCK1B9A5DRE4C|XN--C1AVG|XN--C2BR7G|XN--CCK2B3B|XN--CCKWCXETD|XN--CG4BKI|XN--CLCHC0EA0B2G2A9GCD|XN--CZR694B|XN--CZRS0T|XN--CZRU2D|XN--D1ACJ3B|XN--D1ALF|XN--E1A4C|XN--ECKVDTC9D|XN--EFVY88H|XN--FCT429K|XN--FHBEI|XN--FIQ228C5HS|XN--FIQ64B|XN--FIQS8S|XN--FIQZ9S|XN--FJQ720A|XN--FLW351E|XN--FPCRJ9C3D|XN--FZC2C9E2C|XN--FZYS8D69UVGM|XN--G2XX48C|XN--GCKR3F0F|XN--GECRJ9C|XN--GK3AT1E|XN--H2BREG3EVE|XN--H2BRJ9C|XN--H2BRJ9C8C|XN--HXT814E|XN--I1B6B1A6A2E|XN--IMR513N|XN--IO0A7I|XN--J1AEF|XN--J1AMH|XN--J6W193G|XN--JLQ480N2RG|XN--JLQ61U9W7B|XN--JVR189M|XN--KCRX77D1X4A|XN--KPRW13D|XN--KPRY57D|XN--KPUT3I|XN--L1ACC|XN--LGBBAT1AD8J|XN--MGB9AWBF|XN--MGBA3A3EJT|XN--MGBA3A4F16A|XN--MGBA7C0BBN0A|XN--MGBAAKC7DVF|XN--MGBAAM7A8H|XN--MGBAB2BD|XN--MGBAH1A3HJKRD|XN--MGBAI9AZGQP6J|XN--MGBAYH7GPA|XN--MGBBH1A|XN--MGBBH1A71E|XN--MGBC0A9AZCG|XN--MGBCA7DZDO|XN--MGBCPQ6GPA1A|XN--MGBERP4A5D4AR|XN--MGBGU82A|XN--MGBI4ECEXP|XN--MGBPL2FH|XN--MGBT3DHD|XN--MGBTX2B|XN--MGBX4CD0AB|XN--MIX891F|XN--MK1BU44C|XN--MXTQ1M|XN--NGBC5AZD|XN--NGBE9E0A|XN--NGBRX|XN--NODE|XN--NQV7F|XN--NQV7FS00EMA|XN--NYQY26A|XN--O3CW4H|XN--OGBPF8FL|XN--OTU796D|XN--P1ACF|XN--P1AI|XN--PGBS0DH|XN--PSSY2U|XN--Q7CE6A|XN--Q9JYB4C|XN--QCKA1PMC|XN--QXA6A|XN--QXAM|XN--RHQV96G|XN--ROVU88B|XN--RVC1E0AM3E|XN--S9BRJ9C|XN--SES554G|XN--T60B56A|XN--TCKWE|XN--TIQ49XQYJ|XN--UNUP4Y|XN--VERMGENSBERATER-CTB|XN--VERMGENSBERATUNG-PWB|XN--VHQUV|XN--VUQ861B|XN--W4R85EL8FHU5DNRA|XN--W4RS40L|XN--WGBH1C|XN--WGBL6A|XN--XHQ521B|XN--XKC2AL3HYE2A|XN--XKC2DL3A5EE0H|XN--Y9A3AQ|XN--YFRO4I67O|XN--YGBI2AMMX|XN--ZFR164B|XXX|XYZ|YACHTS|YAHOO|YAMAXUN|YANDEX|YE|YODOBASHI|YOGA|YOKOHAMA|YOU|YOUTUBE|YT|YUN|ZA|ZAPPOS|ZARA|ZERO|ZIP|ZM|ZONE|ZUERICH|ZW)$/i;
            return !!(regexp.test(hostname) || net.isIPv4(hostname) || net.isIPv6(hostname));
        }

        if (!/^\/https?:/.test(req.url) && !isValidHostName(location.hostname)) {
            // Don't even try to proxy invalid hosts (such as /favicon.ico, /robots.txt)

            const uri = new URL(req.url ?? web_server_url, "http://localhost:3000");
            if (uri.pathname === "/m3u8-proxy") {
                logger.info('M3U8 proxy request', {
                    requestId: req.corsAnywhereRequestState.requestId,
                    targetUrl: uri.searchParams.get("url")
                });
                let headers = {};
                try {
                    headers = JSON.parse(uri.searchParams.get("headers") ?? "{}");
                    logger.debug('Parsed M3U8 proxy headers', {
                        requestId: req.corsAnywhereRequestState.requestId,
                        headers: headers
                    });
                } catch (e: any) {
                    logger.error('Failed to parse M3U8 proxy headers', {
                        requestId: req.corsAnywhereRequestState.requestId,
                        error: e,
                        headersParam: uri.searchParams.get("headers")
                    });
                    res.writeHead(500);
                    res.end(e.message);
                    return;
                }
                const url = uri.searchParams.get("url");
                return proxyM3U8(url ?? "", headers, res);
            } else if (uri.pathname === "/ts-proxy") {
                logger.info('TS proxy request', {
                    requestId: req.corsAnywhereRequestState.requestId,
                    targetUrl: uri.searchParams.get("url")
                });
                let headers = {};
                try {
                    headers = JSON.parse(uri.searchParams.get("headers") ?? "{}");
                    logger.debug('Parsed TS proxy headers', {
                        requestId: req.corsAnywhereRequestState.requestId,
                        headers: headers
                    });
                } catch (e: any) {
                    logger.error('Failed to parse TS proxy headers', {
                        requestId: req.corsAnywhereRequestState.requestId,
                        error: e,
                        headersParam: uri.searchParams.get("headers")
                    });
                    res.writeHead(500);
                    res.end(e.message);
                    return;
                }
                const url = uri.searchParams.get("url");
                return proxyTs(url ?? "", headers, req, res);
            } else if (uri.pathname === "/api/video-proxy") {
                logger.info('Video proxy request', {
                    requestId: req.corsAnywhereRequestState.requestId,
                    method: req.method,
                    targetUrl: uri.searchParams.get("url")
                });
                return proxyVideo(req, res, uri);
            } else if (uri.pathname === "/api/proxy") {
                logger.info('General proxy request', {
                    requestId: req.corsAnywhereRequestState.requestId,
                    method: req.method
                });
                return proxyGeneral(req, res);
            } else if (uri.pathname === "/") {
                logger.debug('Serving index.html for root path', {
                    requestId: req.corsAnywhereRequestState.requestId
                });
                return res.end(readFileSync(join(__dirname, "../index.html")));
            } else {
                logger.warn('Invalid host or path', {
                    requestId: req.corsAnywhereRequestState.requestId,
                    hostname: location.hostname,
                    pathname: uri.pathname
                });
                res.writeHead(404, "Invalid host", cors_headers);
                res.end("Invalid host: " + location.hostname);
                return;
            }
        }

        if (!hasRequiredHeaders(req.headers)) {
            res.writeHead(400, "Header required", cors_headers);
            res.end("Missing required request header. Must specify one of: " + corsAnywhere.requireHeader);
            return;
        }

        const origin = req.headers.origin || "";
        if ((corsAnywhere.originBlacklist as any[]).indexOf(origin) >= 0) {
            logger.warn('Origin blacklisted', {
                requestId: req.corsAnywhereRequestState.requestId,
                origin: origin,
                url: location.href
            });
            res.writeHead(403, "Forbidden", cors_headers);
            res.end('The origin "' + origin + '" was blacklisted by the operator of this proxy.');
            return;
        }

        if (corsAnywhere.originWhitelist.length && (corsAnywhere.originWhitelist as any[]).indexOf(origin) === -1) {
            logger.warn('Origin not whitelisted', {
                requestId: req.corsAnywhereRequestState.requestId,
                origin: origin,
                whitelist: corsAnywhere.originWhitelist,
                url: location.href
            });
            res.writeHead(403, "Forbidden", cors_headers);
            res.end('The origin "' + origin + '" was not whitelisted by the operator of this proxy.');
            return;
        }

        const rateLimitMessage = corsAnywhere.checkRateLimit && (corsAnywhere as any).checkRateLimit(origin);
        if (rateLimitMessage) {
            logger.warn('Rate limit exceeded', {
                requestId: req.corsAnywhereRequestState.requestId,
                origin: origin,
                message: rateLimitMessage,
                url: location.href
            });
            res.writeHead(429, "Too Many Requests", cors_headers);
            res.end('The origin "' + origin + '" has sent too many requests.\n' + rateLimitMessage);
            return;
        }

        if (corsAnywhere.redirectSameOrigin && origin && location.href[origin.length] === "/" && location.href.lastIndexOf(origin, 0) === 0) {
            // Send a permanent redirect to offload the server. Badly coded clients should not waste our resources.
            cors_headers.vary = "origin";
            cors_headers["cache-control"] = "private";
            cors_headers.location = location.href;
            res.writeHead(301, "Please use a direct request", cors_headers);
            res.end();
            return;
        }

        const isRequestedOverHttps = req.connection.encrypted || /^\s*https/.test(req.headers["x-forwarded-proto"]);
        const proxyBaseUrl = (isRequestedOverHttps ? "https://" : "http://") + req.headers.host;

        corsAnywhere.removeHeaders.forEach(function (header) {
            delete req.headers[header];
        });

        Object.keys(corsAnywhere.setHeaders).forEach(function (header) {
            req.headers[header] = corsAnywhere.setHeaders[header];
        });

        req.corsAnywhereRequestState.location = location;
        req.corsAnywhereRequestState.proxyBaseUrl = proxyBaseUrl;

        proxyRequest(req, res, proxy);
    };
}

// Create server with default and given values
// Creator still needs to call .listen()
function createServer(options) {
    options = options || {};

    // Default options:
    const httpProxyOptions = {
        xfwd: true, // Append X-Forwarded-* headers
        secure: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0",
    };
    // Allow user to override defaults and add own options
    if (options.httpProxyOptions) {
        Object.keys(options.httpProxyOptions).forEach(function (option) {
            httpProxyOptions[option] = options.httpProxyOptions[option];
        });
    }

    const proxyServer = httpProxy.createServer(httpProxyOptions);
    const requestHandler = getHandler(options, proxyServer);
    let server: Server;
    if (options.httpsOptions) {
        server = https.createServer(options.httpsOptions, requestHandler);
    } else {
        server = http.createServer(requestHandler);
    }

    // When the server fails, just show a 404 instead of Internal server error
    proxyServer.on("error", function (err, req, res) {
        const requestId = req?.corsAnywhereRequestState?.requestId || 'unknown';
        logger.error('Proxy server error', {
            requestId: requestId,
            error: err,
            url: req?.url,
            method: req?.method,
            headersSent: res?.headersSent,
            writableEnded: res?.writableEnded
        });
        
        if (res.headersSent) {
            // This could happen when a protocol error occurs when an error occurs
            // after the headers have been received (and forwarded). Do not write
            // the headers because it would generate an error.
            // Prior to Node 13.x, the stream would have ended.
            // As of Node 13.x, we must explicitly close it.
            logger.debug('Headers already sent, ending response', { requestId: requestId });
            if (res.writableEnded === false) {
                res.end();
            }
            return;
        }

        // When the error occurs after setting headers but before writing the response,
        // then any previously set headers must be removed.
        const headerNames = res.getHeaderNames ? res.getHeaderNames() : Object.keys(res._headers || {});
        headerNames.forEach(function (name) {
            res.removeHeader(name);
        });

        res.writeHead(404, { "Access-Control-Allow-Origin": "*" });
        res.end("Not found because of proxy error: " + err);
    });

    return server;
}

const host = process.env.HOST || "0.0.0.0";
const port = process.env.PORT || 8081;
const web_server_url = process.env.PUBLIC_URL || `http://${host}:${port}`;

export default function server() {
    logger.info('Starting M3U8 Proxy Server', {
        host: host,
        port: port,
        publicUrl: web_server_url,
        nodeEnv: process.env.NODE_ENV,
        corsWhitelist: process.env.CORSANYWHERE_WHITELIST,
        corsBlacklist: process.env.CORSANYWHERE_BLACKLIST,
        rateLimit: process.env.CORSANYWHERE_RATELIMIT
    });
    
    const originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
    const originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
    
    function parseEnvList(env) {
        if (!env) {
            return [];
        }
        return env.split(",");
    }
    
    logger.debug('Parsed environment lists', {
        originBlacklist: originBlacklist,
        originWhitelist: originWhitelist
    });

    const serverConfig = {
        originBlacklist: originBlacklist,
        originWhitelist: originWhitelist,
        requireHeader: [],
        checkRateLimit: createRateLimitChecker(process.env.CORSANYWHERE_RATELIMIT),
        removeHeaders: [
            "cookie",
            "cookie2",
            // Strip Heroku-specific headers
            "x-request-start",
            "x-request-id",
            "via",
            "connect-time",
            "total-route-time",
            // Other Heroku added debug headers
            // 'x-forwarded-for',
            // 'x-forwarded-proto',
            // 'x-forwarded-port',
        ],
        redirectSameOrigin: true,
        httpProxyOptions: {
            // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
            xfwd: false,
        },
    };
    
    logger.debug('Server configuration', serverConfig);

    createServer(serverConfig).listen(port, Number(host), function () {
        logger.info('Server started successfully', {
            host: host,
            port: port,
            url: web_server_url
        });
        console.log(colors.green("Server running on ") + colors.blue(`${web_server_url}`));
    });
}

function createRateLimitChecker(CORSANYWHERE_RATELIMIT) {
    // Configure rate limit. The following format is accepted for CORSANYWHERE_RATELIMIT:
    // <max requests per period> <period in minutes> <non-ratelimited hosts>
    // where <non-ratelimited hosts> is a space-separated list of strings or regexes (/.../) that
    // matches the whole host (ports have to be listed explicitly if applicable).
    // <period in minutes> cannot be zero.
    //
    // Examples:
    // - Allow any origin to make one request per 5 minutes:
    //   1 5
    //
    // - Allow example.com to make an unlimited number of requests, and the others 1 per 5 minutes.
    //   1 5 example.com
    //
    // - Allow example.com, or any subdomain to make any number of requests and block the rest:
    //   0 1 /(.*\.)?example\.com/
    //
    // - Allow example.com and www.example.com, and block the rest:
    //   0 1 example.com www.example.com
    const rateLimitConfig = /^(\d+) (\d+)(?:\s*$|\s+(.+)$)/.exec(CORSANYWHERE_RATELIMIT);
    if (!rateLimitConfig) {
        // No rate limit by default.
        return function checkRateLimit() {};
    }
    const maxRequestsPerPeriod = parseInt(rateLimitConfig[1]);
    const periodInMinutes = parseInt(rateLimitConfig[2]);
    let unlimitedPattern: any = rateLimitConfig[3]; // Will become a RegExp or void.
    if (unlimitedPattern) {
        const unlimitedPatternParts: string[] = [];
        unlimitedPattern
            .trim()
            .split(/\s+/)
            .forEach(function (unlimitedHost, i) {
                const startsWithSlash = unlimitedHost.charAt(0) === "/";
                const endsWithSlash = unlimitedHost.slice(-1) === "/";
                if (startsWithSlash || endsWithSlash) {
                    if (unlimitedHost.length === 1 || !startsWithSlash || !endsWithSlash) {
                        throw new Error("Invalid CORSANYWHERE_RATELIMIT. Regex at index " + i + ' must start and end with a slash ("/").');
                    }
                    unlimitedHost = unlimitedHost.slice(1, -1);
                    // Throws if the pattern is invalid.
                    new RegExp(unlimitedHost);
                } else {
                    // Just escape RegExp characters even though they cannot appear in a host name.
                    // The only actual important escape is the dot.
                    unlimitedHost = unlimitedHost.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
                }
                unlimitedPatternParts.push(unlimitedHost);
            });
        unlimitedPattern = new RegExp("^(?:" + unlimitedPatternParts.join("|") + ")$", "i");
    }

    let accessedHosts = Object.create(null);
    setInterval(function () {
        accessedHosts = Object.create(null);
    }, periodInMinutes * 60000);

    const rateLimitMessage = "The number of requests is limited to " + maxRequestsPerPeriod + (periodInMinutes === 1 ? " per minute" : " per " + periodInMinutes + " minutes") + ". " + "Please self-host CORS Anywhere if you need more quota. " + "See https://github.com/Rob--W/cors-anywhere#demo-server";

    return function checkRateLimit(origin) {
        const host = origin.replace(/^[\w\-]+:\/\//i, "");
        if (unlimitedPattern && unlimitedPattern.test(host)) {
            return;
        }
        let count = accessedHosts[host] || 0;
        ++count;
        if (count > maxRequestsPerPeriod) {
            return rateLimitMessage;
        }
        accessedHosts[host] = count;
    };
}

/**
 * @description Proxies m3u8 files and replaces the content to point to the proxy.
 * @param headers JSON headers
 * @param res Server response object
 */
export async function proxyM3U8(url: string, headers: any, res: http.ServerResponse) {
    logger.info('Starting M3U8 proxy request', {
        url: url,
        headers: headers
    });
    
    const req = await axios(url, {
        headers: headers,
        timeout: 100000 //
    }).catch((err) => {
        logger.error('Failed to fetch M3U8 file', {
            url: url,
            error: err,
            headers: headers
        });
        res.writeHead(500);
        res.end(err.message);
        return null;
    });
    
    if (!req) {
        logger.warn('M3U8 request failed, no response received', { url: url });
        return;
    }
    
    logger.debug('M3U8 file fetched successfully', {
        url: url,
        statusCode: req.status,
        contentLength: req.headers['content-length'],
        contentType: req.headers['content-type']
    });

    const m3u8 = req.data;
    if (m3u8.includes("RESOLUTION=")) {
        logger.info('Processing master M3U8 playlist', {
            url: url,
            contentLength: m3u8.length
        });
        // Deals with the master m3u8 and replaces all sub-m3u8 files (quality m3u8 files basically) to use the m3u8 proxy.
        // So if there is 360p, 480p, etc. Instead, the URL's of those m3u8 files will be replaced with the proxy URL.
        const lines = m3u8.split("\n");
        const newLines: string[] = [];
        logger.debug('Master M3U8 has ' + lines.length + ' lines to process');
        for (const line of lines) {
            if (line.startsWith("#")) {
                if (line.startsWith("#EXT-X-KEY:")) {
                    const regex = /https?:\/\/[^\""\s]+/g;
                    const url = `${web_server_url}${"/ts-proxy?url=" + encodeURIComponent(regex.exec(line)?.[0] ?? "") + "&headers=" + encodeURIComponent(JSON.stringify(headers))}`;
                    newLines.push(line.replace(regex, url));
                } else {
                    newLines.push(line);
                }
            } else {
                const uri = new URL(line, url);
                newLines.push(`${web_server_url + "/m3u8-proxy?url=" + encodeURIComponent(uri.href) + "&headers=" + encodeURIComponent(JSON.stringify(headers))}`);
            }
        }

        ["Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers", "Access-Control-Max-Age", "Access-Control-Allow-Credentials", "Access-Control-Expose-Headers", "Access-Control-Request-Method", "Access-Control-Request-Headers", "Origin", "Vary", "Referer", "Server", "x-cache", "via", "x-amz-cf-pop", "x-amz-cf-id"].map((header) => res.removeHeader(header));

        // You need these headers so that the client recognizes the response as an m3u8.
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Methods", "*");

        logger.info('Master M3U8 processing completed', {
            url: url,
            originalLines: lines.length,
            processedLines: newLines.length
        });
        res.end(newLines.join("\n"));
        return;
    } else {
        logger.info('Processing individual quality M3U8 playlist', {
            url: url,
            contentLength: m3u8.length
        });
        // Deals with each individual quality. Replaces the TS files with the proxy URL.
        const lines = m3u8.split("\n");
        const newLines: string[] = [];
        logger.debug('Individual M3U8 has ' + lines.length + ' lines to process');
        for (const line of lines) {
            if (line.startsWith("#")) {
                if (line.startsWith("#EXT-X-KEY:")) {
                    const regex = /https?:\/\/[^\""\s]+/g;
                    const url = `${web_server_url}${"/ts-proxy?url=" + encodeURIComponent(regex.exec(line)?.[0] ?? "") + "&headers=" + encodeURIComponent(JSON.stringify(headers))}`;
                    newLines.push(line.replace(regex, url));
                } else {
                    newLines.push(line);
                }
            } else {
                const uri = new URL(line, url);
                // CORS is needed since the TS files are not on the same domain as the client.
                // This replaces each TS file to use a TS proxy with the headers attached.
                // So each TS request will use the headers inputted to the proxy
                newLines.push(`${web_server_url}${"/ts-proxy?url=" + encodeURIComponent(uri.href) + "&headers=" + encodeURIComponent(JSON.stringify(headers))}`);
            }
        }

        // Removes headers that are not needed for the client.
        ["Access-Control-Allow-Origin", "Access-Control-Allow-Methods", "Access-Control-Allow-Headers", "Access-Control-Max-Age", "Access-Control-Allow-Credentials", "Access-Control-Expose-Headers", "Access-Control-Request-Method", "Access-Control-Request-Headers", "Origin", "Vary", "Referer", "Server", "x-cache", "via", "x-amz-cf-pop", "x-amz-cf-id"].map((header) => res.removeHeader(header));

        // You need these headers so that the client recognizes the response as an m3u8.
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "*");
        res.setHeader("Access-Control-Allow-Methods", "*");

        logger.info('Individual M3U8 processing completed', {
            url: url,
            originalLines: lines.length,
            processedLines: newLines.length
        });
        res.end(newLines.join("\n"));
        return;
    }
}

/**
 * @description Proxies TS files. Sometimes TS files require headers to be sent with the request.
 * @param headers JSON headers
 * @param req Client request object
 * @param res Server response object
 */
export async function proxyTs(url: string, headers: any, req, res: http.ServerResponse) {
    logger.info('Starting TS proxy request', {
        url: url,
        headers: headers,
        method: req.method
    });
    
    // I love how NodeJS HTTP request client only takes http URLs :D It's so fun!
    // I'll probably refactor this later.

    let forceHTTPS = false;

    if (url.startsWith("https://")) {
        forceHTTPS = true;
        logger.debug('Using HTTPS for TS proxy', { url: url });
    } else {
        logger.debug('Using HTTP for TS proxy', { url: url });
    }

    const uri = new URL(url);
    logger.debug('Parsed TS URL', {
        hostname: uri.hostname,
        port: uri.port,
        pathname: uri.pathname,
        search: uri.search
    });

    // Options
    // It might be worth adding ...req.headers to the headers object, but once I did that
    // the code broke and I receive errors such as "Cannot access direct IP" or whatever.
    const options = {
        hostname: uri.hostname,
        port: uri.port,
        path: uri.pathname + uri.search,
        method: req.method,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.132 Safari/537.36",
            ...headers,
        },
    };
    
    logger.debug('TS proxy request options', options);

    res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Proxy request and pipe to client
    try {
        logger.debug('Initiating TS proxy request', {
            url: url,
            forceHTTPS: forceHTTPS,
            method: req.method
        });
        if (forceHTTPS) {
            const proxy = https.request(options, (r) => {
                logger.debug('HTTPS TS proxy response received', {
                    url: url,
                    statusCode: r.statusCode,
                    headers: r.headers
                });
                r.headers["content-type"] = "video/mp2t";
                r.headers["Access-Control-Allow-Origin"] = "*";
                res.writeHead(r.statusCode ?? 200, r.headers);

                r.pipe(res, {
                    end: true,
                });
            });
            proxy.on('error', (error) => {
                logger.error('HTTPS TS proxy request failed', {
                    url: url,
                    error: error.message,
                    stack: error.stack
                });
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Proxy error');
                }
            });

            req.pipe(proxy, {
                end: true,
            });
        } else {
            const proxy = http.request(options, (r) => {
                logger.debug('HTTP TS proxy response received', {
                    url: url,
                    statusCode: r.statusCode,
                    headers: r.headers
                });
                r.headers["content-type"] = "video/mp2t";
                res.writeHead(r.statusCode ?? 200, r.headers);

                r.pipe(res, {
                    end: true,
                });
            });
            proxy.on('error', (error) => {
                logger.error('HTTP TS proxy request failed', {
                    url: url,
                    error: error.message,
                    stack: error.stack
                });
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Proxy error');
                }
            });
            req.pipe(proxy, {
                end: true,
            });
        }
    } catch (e: any) {
        logger.error('Unexpected error in TS proxy', {
            url: url,
            error: e.message,
            stack: e.stack,
            method: req.method
        });
        if (!res.headersSent) {
            res.writeHead(500);
            res.end(e.message);
        }
        return null;
    }
    
    logger.info('TS proxy request completed', { url: url });
}

/**
 * @description Proxies video files with range support and proper headers
 * @param req Client request object
 * @param res Server response object
 * @param uri Parsed URL object
 */
export async function proxyVideo(req: any, res: http.ServerResponse, uri: URL) {
    try {
        // Handle OPTIONS requests
        if (req.method === 'OPTIONS') {
            const response_headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Range, Content-Type, Authorization',
                'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
                'Access-Control-Max-Age': '86400'
            };
            res.writeHead(200, response_headers);
            res.end();
            return;
        }

        const url = uri.searchParams.get('url');
        const referer = uri.searchParams.get('referer') || '';
        const use_cloudscraper = uri.searchParams.get('cf') === 'true';
        const enable_cache = uri.searchParams.get('cache') === 'true';
        
        if (!url) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('URL parameter is required');
            return;
        }

        const upstream_headers: any = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': '*/*',
            'Connection': 'keep-alive',
        };
        
        if (req.method === 'GET') {
            upstream_headers['Sec-Fetch-Dest'] = 'video';
        }
        
        if (referer) upstream_headers['Referer'] = referer;
        const range_header = req.headers['range'];
        if (range_header && req.method === 'GET') upstream_headers['Range'] = range_header;
        
        logger.debug('Video proxy request details', {
            url: url,
            method: req.method,
            referer: referer,
            range: range_header,
            cloudscraper: use_cloudscraper
        });

        let response;
        const axiosConfig: any = {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            url: url,
            headers: upstream_headers,
            timeout: req.method === 'HEAD' ? 10000 : 30000,
            validateStatus: () => true // Accept all status codes
        };

        if (req.method === 'GET') {
            axiosConfig.responseType = 'stream';
        }

        response = await axios(axiosConfig);
        
        if (response.status >= 400) {
            logger.error('Upstream server error', {
                url: url,
                status: response.status,
                statusText: response.statusText
            });
            res.writeHead(response.status, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Upstream server returned ${response.status}` }));
            return;
        }
        
        const response_headers: any = {};
        const headers_to_copy = ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges', 'Last-Modified', 'ETag', 'Cache-Control'];
        
        for (const header of headers_to_copy) {
            if (response.headers[header.toLowerCase()]) {
                response_headers[header] = response.headers[header.toLowerCase()];
            }
        }
        
        // Set CORS headers
        response_headers['Access-Control-Allow-Origin'] = '*';
        response_headers['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
        response_headers['Access-Control-Allow-Headers'] = 'Range, Content-Type, Authorization';
        response_headers['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Accept-Ranges';
        
        if (!response_headers['Accept-Ranges']) response_headers['Accept-Ranges'] = 'bytes';
        
        if (enable_cache) {
            response_headers['Cache-Control'] = 'public, max-age=3600, stale-while-revalidate=86400';
            response_headers['Vary'] = 'Range';
        } else {
            response_headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        }
        
        if (req.method === 'HEAD') {
            res.writeHead(200, response_headers);
            res.end();
            return;
        }
        
        const status_code = range_header && response.status === 206 ? 206 : 200;
        res.writeHead(status_code, response_headers);
        
        response.data.pipe(res);
        
        logger.info('Video proxy request completed successfully', {
            url: url,
            method: req.method,
            status: status_code,
            contentType: response_headers['Content-Type']
        });
        
    } catch (error: any) {
        logger.error('Video proxy error', {
            error: error.message,
            stack: error.stack
        });
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'An unexpected error occurred.' }));
        }
    }
}

/**
 * @description Handles general proxy requests (POST/GET)
 * @param req Client request object
 * @param res Server response object
 */
export async function proxyGeneral(req: any, res: http.ServerResponse) {
    try {
        // Handle OPTIONS requests
        if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '86400');
            res.writeHead(200);
            res.end();
            return;
        }

        let body = '';
        
        // Collect request body for POST requests
        req.on('data', (chunk: any) => {
            body += chunk.toString();
        });
        
        req.on('end', async () => {
            try {
                const data = body ? JSON.parse(body) : {};
                const url = data.url;
                const method = (data.method || 'GET').toUpperCase();
                const headers = data.headers || {};
                const use_cloudscraper = data.cf || false;
                const timeout = data.timeout || 30;
                
                if (!url) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'URL is required' }));
                    return;
                }
                
                if (!['GET', 'POST'].includes(method)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Only GET and POST methods are allowed' }));
                    return;
                }
                
                logger.debug('General proxy request', {
                    url: url,
                    method: method,
                    cloudscraper: use_cloudscraper,
                    timeout: timeout
                });
                
                let response;
                const config: any = {
                    method: method,
                    url: url,
                    headers: headers,
                    timeout: timeout * 1000,
                    responseType: 'arraybuffer',
                    validateStatus: () => true // Accept all status codes
                };
                
                if (method === 'POST' && data.form_data) {
                    config.data = data.form_data;
                }
                
                response = await axios(config);
                
                // Set CORS headers
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
                
                res.writeHead(response.status, {
                    'Content-Type': response.headers['content-type'] || 'application/octet-stream'
                });
                res.end(Buffer.from(response.data));
                
                logger.info('General proxy request completed', {
                    url: url,
                    method: method,
                    status: response.status
                });
                
            } catch (parseError: any) {
                logger.error('Error parsing request body', {
                    error: parseError.message,
                    body: body
                });
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON in request body' }));
            }
        });
        
    } catch (error: any) {
        logger.error('General proxy error', {
            error: error.message,
            stack: error.stack
        });
        if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'An unexpected error occurred.' }));
        }
    }
}
