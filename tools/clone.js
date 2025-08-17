import fs from 'fs';

export async function fetchAndSaveHtml(url = '') {
  let response = await fetch(url)
  let data = await response.text()

  fs.writeFileSync('clone.html', data)

  return 'HTML data fetched.'
}

export async function fetchAndSaveStyles(url = '') {
  try {
    if (fs.existsSync('assets')) fs.rmSync('assets', { recursive: true, force: true });
    fs.mkdirSync('assets', { recursive: true });

    let html = fs.readFileSync('clone.html', 'utf8');

    let styleLinks = html.match(/<link[^>]*?rel="stylesheet"[^>]*?href="(.*?)"[^>]*?>/g) || []

    for (let link of styleLinks) {
      let styleUrl = link.match(/href="(.*?)"/)[1];
      let fullUrl = styleUrl.startsWith('http') ? styleUrl : new URL(styleUrl, url).href;

      try {
        let css = await (await fetch(fullUrl)).text();
        let localPath = `assets/style-${Date.now()}.css`;
        fs.writeFileSync(localPath, css);

        html = html.replace(link, `<link rel="stylesheet" href="${localPath}">`);
      } catch (err) {
        console.log(`Skipping ${fullUrl}:`, err.message);
      }
    }

    fs.writeFileSync('clone.html', html);
    return 'Styles saved successfully';

  } catch (error) {
    return `Error: ${error.message}`;
  }
}
