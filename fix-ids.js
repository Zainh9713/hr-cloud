const fs = require('fs');
const path = require('path');

function walk(dir) {
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            walk(file);
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            let content = fs.readFileSync(file, 'utf8');
            const regex = /([a-zA-Z0-9_]+)\._id\.toString\(\)/g;
            if (regex.test(content)) {
                content = content.replace(regex, 'String($1._id)');
                fs.writeFileSync(file, content);
                console.log('Fixed', file);
            }
        }
    });
}
walk('./src');
