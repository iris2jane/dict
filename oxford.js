/* global api */
class oxford {
    constructor() {
        this.name = 'oxford';
        this.baseUrl = 'https://www.oxfordlearnersdictionaries.com/definition/english/';
    }

    async findTerm(word) {
        // 构建查询URL
        let url = this.baseUrl + word.toLowerCase();
        let doc = null;
        try {
            let data = await api.fetch(url);
            doc = new DOMParser().parseFromString(data, 'text/html');
        } catch (err) {
            return null;
        }

        let definition = [];
        
        // 获取音标
        let phonetics = doc.querySelector('.phons_br');
        let phoneticText = phonetics ? phonetics.textContent.trim() : '';
        
        // 获取词性
        let pos = doc.querySelector('.pos');
        let posText = pos ? pos.textContent.trim() : '';
        
        // 获取释义
        let senses = doc.querySelectorAll('.sense');
        senses.forEach((sense, index) => {
            let def = sense.querySelector('.def');
            if (def) {
                // 获取例句
                let examples = [];
                sense.querySelectorAll('.x').forEach(ex => {
                    examples.push(ex.textContent.trim());
                });
                
                definition.push({
                    pos: posText,
                    def: def.textContent.trim(),
                    examples: examples
                });
            }
        });

        return {
            phonetic: phoneticText,
            definitions: definition
        };
    }

    renderContent(content) {
        if (!content) return '';
        
        let html = '';
        html += `<div class="oxford-phonetic">${content.phonetic}</div>`;
        
        content.definitions.forEach((def, index) => {
            html += `
            <div class="oxford-definition">
                <div class="pos">${def.pos}</div>
                <div class="def">${index + 1}. ${def.def}</div>
                ${def.examples.map(ex => `<div class="example">• ${ex}</div>`).join('')}
            </div>`;
        });
        
        return html;
    }
}

// 注册词典
if (typeof module !== "undefined") {
    module.exports = oxford;
} else {
    window.oxford = oxford;
} 