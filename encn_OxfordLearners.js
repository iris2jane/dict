/* global api */
class encn_OxfordLearners {
    constructor(options) {
        this.options = options;
        this.maxexample = 2;
        this.word = '';
        this.token = '';
        this.gtk = '';
    }

    async displayName() {
        let locale = await api.locale();
        if (locale.indexOf('CN') != -1) return '牛津学习词典';
        if (locale.indexOf('TW') != -1) return '牛津學習詞典';
        return 'Oxford Learner\'s Dictionary';
    }

    setOptions(options) {
        this.options = options;
        this.maxexample = options.maxexample;
    }

    async getToken() {
        let homeurl = 'https://fanyi.baidu.com/';
        let homepage = await api.fetch(homeurl);
        let tmatch = /token: ['"](.+?)['"]/gi.exec(homepage);
        if (!tmatch || tmatch.length < 2) return null;
        let gmatch = /window.gtk = ['"](.+?)['"]/gi.exec(homepage);
        if (!gmatch || gmatch.length < 2) return null;
        return {
            'token': tmatch[1],
            'gtk': gmatch[1]
        };
    }

    async findTerm(word) {
        this.word = word;
        let deflection = await api.deinflect(word) || [];
        let promises = [word, ...deflection].map(x => this.findOxfordLearners(x));
        let results = await Promise.all(promises);
        return [].concat(...results).filter(x => x);
    }

    async findOxfordLearners(word) {
        if (!word) return [];
        
        let base = 'https://www.oxfordlearnersdictionaries.com/definition/english/';
        let url = base + encodeURIComponent(word.toLowerCase());
        let doc = '';
        try {
            let data = await api.fetch(url);
            let parser = new DOMParser();
            doc = parser.parseFromString(data, 'text/html');
        } catch (err) {
            return [];
        }

        let notes = [];
        let entries = doc.querySelectorAll('.entry') || [];

        if (entries.length === 0) {
            // 如果没有找到词条，尝试使用百度翻译
            return await this.findBaiduTranslate(word);
        }

        for (const entry of entries) {
            let expression = word;
            let reading = '';
            let extrainfo = '';
            let definitions = [];

            let header = entry.querySelector('.webtop');
            if (header) {
                let expression_elem = header.querySelector('.headword');
                let reading_elem = header.querySelector('.phon');
                let pos_elem = header.querySelector('.pos');

                if (expression_elem) {
                    expression = expression_elem.textContent.trim();
                }
                
                if (reading_elem) {
                    reading = reading_elem.textContent.trim();
                }
                
                if (pos_elem) {
                    extrainfo = `<span class='pos'>${pos_elem.textContent.trim()}</span>`;
                }
            }

            // 获取音频链接
            let audios = [];
            let audio_uk = entry.querySelector('.sound.audio_play_button.pron-uk');
            let audio_us = entry.querySelector('.sound.audio_play_button.pron-us');
            
            if (audio_uk) {
                let data_src_mp3 = audio_uk.getAttribute('data-src-mp3');
                if (data_src_mp3) audios.push(data_src_mp3);
            }
            
            if (audio_us) {
                let data_src_mp3 = audio_us.getAttribute('data-src-mp3');
                if (data_src_mp3) audios.push(data_src_mp3);
            }

            // 获取释义和例句
            let senses = entry.querySelectorAll('.sense');
            for (const sense of senses) {
                let definition = '';
                
                // 获取释义编号
                let senseid = sense.querySelector('.senseid');
                if (senseid) {
                    definition += `<span class="senseid">${senseid.textContent.trim()}</span>`;
                }
                
                // 获取释义
                let def = sense.querySelector('.def');
                if (def) {
                    let eng_def = def.textContent.trim();
                    // 获取中文翻译
                    let chn_def = await this.getChineseTranslation(eng_def);
                    definition += `<span class='tran'><span class='eng_tran'>${eng_def}</span><span class='chn_tran'>${chn_def}</span></span>`;
                }
                
                // 获取例句
                let examples = sense.querySelectorAll('.examples .x');
                if (examples && examples.length > 0) {
                    let examplesList = '';
                    let count = 0;
                    for (const example of examples) {
                        if (count >= this.maxexample) break;
                        let eng_sent = example.textContent.trim();
                        // 获取中文翻译
                        let chn_sent = await this.getChineseTranslation(eng_sent);
                        eng_sent = eng_sent.replace(RegExp(expression, 'gi'), `<b>${expression}</b>`);
                        examplesList += `<li class='sent'><span class='eng_sent'>${eng_sent}</span><span class='chn_sent'>${chn_sent}</span></li>`;
                        count++;
                    }
                    if (examplesList) {
                        definition += `<ul class="sents">${examplesList}</ul>`;
                    }
                }
                
                definitions.push(definition);
            }

            let css = encn_OxfordLearners.renderCSS();
            notes.push({ css, expression, reading, extrainfo, definitions, audios });
        }

        return notes;
    }

    async getChineseTranslation(text) {
        if (!text) return '';
        
        if (!this.token || !this.gtk) {
            let common = await this.getToken();
            if (!common) return '';
            this.token = common.token;
            this.gtk = common.gtk;
        }

        let sign = this.generateSign(text, this.gtk);
        if (!sign) return '';

        let base = 'https://fanyi.baidu.com/v2transapi?from=en&to=zh&simple_means_flag=3';
        let url = base + `&query=${encodeURIComponent(text)}&sign=${sign}&token=${this.token}`;
        
        try {
            let data = JSON.parse(await api.fetch(url));
            if (data.trans_result && data.trans_result.data && data.trans_result.data.length > 0) {
                return data.trans_result.data[0].dst;
            }
        } catch (err) {
            return '';
        }
        
        return '';
    }

    async findBaiduTranslate(word) {
        if (!word) return [];
        
        if (!this.token || !this.gtk) {
            let common = await this.getToken();
            if (!common) return [];
            this.token = common.token;
            this.gtk = common.gtk;
        }

        let sign = this.generateSign(word, this.gtk);
        if (!sign) return [];

        let base = 'https://fanyi.baidu.com/v2transapi?from=en&to=zh&simple_means_flag=3';
        let url = base + `&query=${encodeURIComponent(word)}&sign=${sign}&token=${this.token}`;
        
        try {
            let data = JSON.parse(await api.fetch(url));
            
            // 尝试获取百度词典结果
            let simple = data.dict_result && data.dict_result.simple_means;
            if (simple) {
                let expression = simple.word_name;
                if (!expression) return [];

                let symbols = simple.symbols[0];
                let reading_uk = symbols.ph_en || '';
                let reading_us = symbols.ph_am || '';
                let reading = reading_uk && reading_us ? `uk[${reading_uk}] us[${reading_us}]` : '';

                let audios = [];
                audios[0] = `https://fanyi.baidu.com/gettts?lan=uk&text=${encodeURIComponent(expression)}&spd=3&source=web`;
                audios[1] = `https://fanyi.baidu.com/gettts?lan=en&text=${encodeURIComponent(expression)}&spd=3&source=web`;

                if (!symbols.parts || symbols.parts.length < 1) return [];
                let definition = '<ul class="ec">';
                for (const def of symbols.parts)
                    if (def.means && def.means.length > 0) {
                        let pos = def.part || def.part_name || '';
                        pos = pos ? `<span class="pos simple">${pos}</span>` : '';
                        definition += `<li class="ec">${pos}<span class="ec_chn">${def.means.join()}</span></li>`;
                    }
                definition += '</ul>';
                let css = encn_OxfordLearners.renderCSS();
                return [{ css, expression, reading, definitions: [definition], audios }];
            }
            
            // 如果没有词典结果，使用翻译结果
            if (data.trans_result && data.trans_result.data && data.trans_result.data.length > 0) {
                let expression = data.trans_result.data[0].src;
                let definition = data.trans_result.data[0].dst;
                let css = encn_OxfordLearners.renderCSS();
                return [{ css, expression, definitions: [definition] }];
            }
        } catch (err) {
            return [];
        }
        
        return [];
    }

    // 生成百度翻译 API 签名
    generateSign(text, gtk) {
        if (!text || !gtk) return null;
        
        const n = function(r, o) {
            for (let t = 0; t < o.length - 2; t += 3) {
                let a = o.charAt(t + 2);
                a = a >= "a" ? a.charCodeAt(0) - 87 : Number(a),
                a = "+" === o.charAt(t + 1) ? r >>> a : r << a,
                r = "+" === o.charAt(t) ? r + a & 4294967295 : r ^ a
            }
            return r
        };
        
        let i = text.length;
        i > 30 && (text = "" + text.substr(0, 10) + text.substr(Math.floor(i / 2) - 5, 10) + text.substr(-10, 10));
        
        let o = text.split("");
        let t = gtk.split(".");
        let e = Number(t[0]) || 0;
        let h = Number(t[1]) || 0;
        
        for (let s = [], c = 0; c < o.length; c++) {
            let l = o[c].charCodeAt(0);
            128 > l ? s[s.length] = l : (2048 > l ? s[s.length] = l >> 6 | 192 : (55296 === (64512 & l) && c + 1 < o.length && 56320 === (64512 & o[c + 1].charCodeAt(0)) ? (l = 65536 + ((1023 & l) << 10) + (1023 & o[++c].charCodeAt(0)),
            s[s.length] = l >> 18 | 240,
            s[s.length] = l >> 12 & 63 | 128) : s[s.length] = l >> 12 | 224,
            s[s.length] = l >> 6 & 63 | 128),
            s[s.length] = 63 & l | 128)
        }
        
        let g = e;
        for (let f = 0; f < s.length; f++)
            g += s[f],
            g = n(g, "+-a^+6");
        
        return g = n(g, "+-3^+b+-f"),
        g ^= h,
        0 > g && (g = (2147483647 & g) + 2147483648),
        g %= 1e6,
        g.toString() + "." + (g ^ e)
    }

    static renderCSS() {
        let css = `
            <style>
                div.dis {font-weight: bold;margin-bottom:3px;padding:0;}
                span.grammar,
                span.informal   {margin: 0 2px;color: #0d47a1;}
                span.complement {margin: 0 2px;font-weight: bold;}
                div.idmphrase {font-weight: bold;margin: 0;padding: 0;}
                span.eng_dis  {margin-right: 5px;}
                span.chn_dis  {margin: 0;padding: 0;}
                span.pos  {text-transform:lowercase; font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                span.tran {margin:0; padding:0;}
                span.eng_tran {margin-right:3px; padding:0;}
                span.chn_tran {color:#0d47a1;}
                ul.sents {font-size:0.9em; list-style:square inside; margin:3px 0;padding:5px;background:rgba(13,71,161,0.1); border-radius:5px;}
                li.sent  {margin:0; padding:0;}
                span.eng_sent {margin-right:5px;}
                span.chn_sent {color:#0d47a1;}
                span.senseid {font-size:0.9em; margin-right:5px; padding:2px 4px; color:white; background-color:#0d47a1; border-radius:3px;}
                ul.ec, li.ec {margin:0; padding:0;}
                span.simple {background-color: #999!important}
                span.ec_chn {color:#0d47a1;}
            </style>`;
        return css;
    }
} 
