.PHONY: check sync-size sync-js start

check:
	node --check js/app.js
	node --check sw.js
	node -e "JSON.parse(require('fs').readFileSync('manifest.webmanifest','utf8'))"
	python3 -c "import re,sys; css=open('css/styles.css').read().strip(); html=open('index.html').read(); m=re.search(r'<style>\s*(.*?)\s*</style>',html,re.S); inline=m.group(1).strip() if m else ''; assert inline==css,'inline CSS out of sync with css/styles.css'; print('check: OK')"
	python3 -c "import re,sys; js=open('js/app.js').read().strip(); html=open('index.html').read(); m=re.search(r'<script>\s*(.*?)\s*</script>',html,re.S); inline=m.group(1).strip() if m else ''; assert inline==js,'inline JS out of sync with js/app.js'; print('check-js: OK')"
	python3 tests/check_themes.py

sync-size:
	python3 -c "import re; css=open('css/styles.css').read(); html=open('index.html').read(); m=re.search(r'<style>.*?</style>',html,re.S); html=html[:m.start()]+'<style>\n'+css+'\n</style>'+html[m.end():]; open('index.html','w').write(html); print('sync-size: synced css/styles.css -> index.html inline <style>')"

sync-js:
	python3 -c "import re; js=open('js/app.js').read().strip(); html=open('index.html').read(); m=re.search(r'<script>.*?</script>',html,re.S); html=html[:m.start()]+'<script>\n'+js+'\n</script>'+html[m.end():]; open('index.html','w').write(html); print('sync-js: synced js/app.js -> index.html inline <script>')"

start:
	python3 -m http.server 8080
