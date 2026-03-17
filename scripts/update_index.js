const fs = require('fs');
const path = require('path');

// Read existing index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Use regex to locate the existing sermonList
const match = indexHtml.match(/const sermonList\s*=\s*(\[[\s\S]*?\]);/);
let existingList = [];
if (match) {
    try {
        // Evaluate the matched JS array string into an actual array
        // This is safe here because we're just reading our own static HTML file
        existingList = eval(match[1]);
    } catch (e) {
        console.error("기존 sermonList 파싱 실패:", e);
        process.exit(1);
    }
}

// Find all .html files in the root directory (excluding index.html)
const rootDir = path.join(__dirname, '..');
const files = fs.readdirSync(rootDir).filter(f => f.endsWith('.html') && f !== 'index.html');

// Keep track of files that are already in the list
const existingSet = new Set(existingList.map(item => item.filename));

// Find the maximum series number for each book to auto-increment
let maxJohn = 0;
let maxLuke = 0;
existingList.forEach(item => {
    if (item.series && item.series.includes('요한복음 설교')) {
        const num = parseInt(item.series.replace(/[^0-9]/g, ''));
        if (!isNaN(num) && num > maxJohn) maxJohn = num;
    }
    if (item.series && item.series.includes('누가복음 설교')) {
        const num = parseInt(item.series.replace(/[^0-9]/g, ''));
        if (!isNaN(num) && num > maxLuke) maxLuke = num;
    }
});

let newItems = [];

// Check each file whether it's new
files.forEach(file => {
    if (!existingSet.has(file)) {
        const content = fs.readFileSync(path.join(rootDir, file), 'utf8');
        
        let title = "제목 없음";
        const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/);
        if (titleMatch) {
            title = titleMatch[1].trim();
        } else {
            const t2 = content.match(/<title>(.*?)<\/title>/);
            if (t2) {
                title = t2[1].replace(/말씀묵상/g, '').replace(/-/g, '').trim();
            }
        }
        
        let passage = "";
        const pMatch = content.match(/<p[^>]*>((?:요한복음|누가복음).*?)<\/p>/);
        if (pMatch) {
            passage = pMatch[1].trim();
        }
        
        let series = "";
        if (file.toLowerCase().includes('luke') || content.includes('누가복음')) {
            maxLuke++;
            series = `누가복음 설교 ${maxLuke.toString().padStart(2, '0')}`;
        } else if (file.toLowerCase().includes('john') || content.includes('요한복음')) {
            maxJohn++;
            series = `요한복음 설교 ${maxJohn.toString().padStart(2, '0')}`;
        } else {
            series = "설교";
        }
        
        newItems.push({ filename: file, series, passage, title });
    }
});

if (newItems.length > 0) {
    // Sort new items (descending by filename so newest chapters are at the top if multiple are uploaded)
    newItems.sort((a, b) => b.filename.localeCompare(a.filename));
    
    // Add new items to the BEGINNING of the list
    const finalResult = [...newItems, ...existingList];
    
    // Rebuild the JS array string
    let newJsArray = "[\n";
    finalResult.forEach((item, index) => {
        newJsArray += `            { filename: "${item.filename}", series: "${item.series}", passage: "${item.passage}", title: "${item.title}" }`;
        if (index < finalResult.length - 1) {
            newJsArray += ",\n";
        } else {
            newJsArray += "\n";
        }
    });
    newJsArray += "        ]";

    // Replace in file
    indexHtml = indexHtml.replace(/const sermonList\s*=\s*\[[\s\S]*?\];/, `const sermonList = ${newJsArray};`);
    fs.writeFileSync(indexPath, indexHtml);
    
    console.log(`성공적으로 ${newItems.length}개의 새 설교를 index.html 최상단에 추가했습니다!`);
    newItems.forEach(i => console.log(` - ${i.title}`));
} else {
    console.log("새로 추가된 설교 파일이 없습니다.");
}
