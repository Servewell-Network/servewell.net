
import fs from 'node:fs';


export function makeHtmlBase(title: string, description = '') {
    const indexHtml = fs.readFileSync('public/index.html', { encoding: 'utf8' });
    if (!indexHtml) {
        console.error(`No html`);
        process.exit(1);
    }

    const initialHtml = indexHtml.split('<title>')[0];
    return {
        topOfHead: [
            initialHtml,
            `<title>${title}</title>`,
            `<meta name="description" content="${description}">`,
            `<script>`,
            `(function () {`,
            `  try {`,
            `    const savedTheme = localStorage.getItem('servewell-theme');`,
            `    if (savedTheme === 'dark' || savedTheme === 'light') {`,
            `      document.documentElement.dataset.theme = savedTheme;`,
            `    }`,
            `  } catch (_error) {`,
            `    // Ignore storage access failures (private mode, disabled storage).`,
            `  }`,
            `})();`,
            `</script>`,
            `<style>`,
            `body {`,
            `   font-family: sans-serif;`,
            `	font-size: large;`,
            `}`,
            `details :not(summary) {`,
            `   padding-left: 0.5rem;`,
            `}`
        ],
        headToBody: [
            `</style>`,
            `</head>`,
            `<body>`,
            `<h1>${title}</h1>`,
        ],
        bottom: [
            `</body>`,
            `</html>`
        ]
    }
}