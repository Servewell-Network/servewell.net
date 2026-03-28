
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