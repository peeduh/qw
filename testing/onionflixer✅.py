import asyncio, re
from playwright.async_api import async_playwright

async def main():
    m3u8_url = None
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
    
        await page.route("**/*", lambda route: route.abort() if route.request.resource_type in ["image", "stylesheet", "font", "media", "script", "xhr", "fetch", "websocket", "eventsource", "manifest", "other"] else route.continue_())
        
        print("Browser launched")
        
        await page.goto("https://onionplay.ch/")
        await page.set_content(f'<iframe src="https://onflix.su/tt30324320" style="width: 100%; height: 100vh;"></iframe>')
        print("Page loaded")
        
        frame = await page.query_selector('iframe')
        
        if frame:
            frame_context = await frame.content_frame()
            content = await frame_context.content()
            pattern = r'\$\("a\.redirect"\)\.attr\("href","https://([^"]+)"\)'
            new_url = f"https://{re.search(pattern, content).group(1)}"
            
            await frame_context.evaluate(f"document.location.href = '{new_url}'")
            await frame_context.wait_for_load_state('networkidle')
            print("New URL loaded")
            
            updated_content = await frame_context.content()
            juice_pattern = r'JuicyCodes\.Run\(([^)]+)\);'
            juice_match = re.search(juice_pattern, updated_content)
            print("JuicyCodes.Run found")
            
            if juice_match:
                juicy_param = juice_match.group(1)
                
                decode_script = f"""
                var atob=function(f){{var g={{}},b=65,d=0,a,c=0,h,e='',k=String.fromCharCode,l=f.length;for(a='';91>b;)a+=k(b++);a+=a.toLowerCase()+'0123456789+/';for(b=0;64>b;b++)g[a.charAt(b)]=b;for(a=0;a<l;a++)for(b=g[f.charAt(a)],d=(d<<6)+b,c+=6;8<=c;)((h=d>>>(c-=8)&255)||a<l-2)&&(e+=k(h));return e}};
                var result=atob({juicy_param});
                result;
                """
                
                decoded_result = await frame_context.evaluate(decode_script)
                
                eval_match = re.search(r'eval\((.+?)\)$', decoded_result)
                if eval_match:
                    eval_content = eval_match.group(1)
                    print(f"Content evaluated")
                    
                    final_script = f"var result={eval_content}; result;"
                    final_result = await frame_context.evaluate(final_script)
                    print(f"Final result: {final_result}")
                    
                    m3u8_pattern = r'"file":"([^"]*\.m3u8[^"]*)"|"file":"([^"]*video\.m3u8\?token=[^"]*)"|file:\[\{"file":"([^"]*\.m3u8[^"]*)"|file:\[\{"file":"([^"]*video\.m3u8\?token=[^"]*)'  
                    m3u8_match = re.search(m3u8_pattern, final_result)
                    
                    if m3u8_match:
                        m3u8_url = next((group for group in m3u8_match.groups() if group), None)
        
        while not m3u8_url:
            await asyncio.sleep(0.1)
            
        return m3u8_url

print(asyncio.run(main()))

# LOWEST TIME: 3.6s