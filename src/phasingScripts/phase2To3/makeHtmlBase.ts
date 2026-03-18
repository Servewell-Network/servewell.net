
import fs from 'node:fs';
import path from 'node:path';


export function makeHtmlBase(title: string, description = '') {
    const indexHtml = fs.readFileSync('public/index.html', { encoding: 'utf8' });
    if (!indexHtml) {
        console.error(`No html`);
        process.exit(1);
    }

    temporarySideEffect(indexHtml, title); // add link to index.html

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
            `<a href="/">Back to Home</a>`,
        ],
        bottom: [
            `</body>`,
            `</html>`
        ]
    }
}

function temporarySideEffect(indexHtml: string, title: string) {
    const newIndexHtml = indexHtml.replace(
        `<li></li>`,
        `<li></li>\n<li><a href="/-/${title.replaceAll(' ', '-')}">${title}</a></li>`
    );
    fs.writeFileSync(`public/index.html`, newIndexHtml, { encoding: 'utf8' });
}