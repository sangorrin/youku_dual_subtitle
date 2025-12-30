// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2025 Daniel Sangorrin
//
// Youku Dual Subtitle - Dictionary Module
//
// ---
//
// Derived from Zhongwen Chinese-English Pop-Up Dictionary
// Copyright (C) 2010-2023 Christian Schiller
// https://github.com/cschiller/zhongwen
//
// Originally based on Rikaikun 0.8
// Copyright (C) 2010 Erek Speed
// http://code.google.com/p/rikaikun/
//
// Originally based on Rikaichan 1.07
// by Jonathan Zarate
// http://www.polarcloud.com/
//
// Originally based on RikaiXUL 0.4 by Todd Rudick
// http://www.rikai.com/
// http://rikaixul.mozdev.org/


'use strict';

class ZhongwenDictionary {

    constructor(wordDict, wordIndex, grammarKeywords, vocabKeywords) {
        this.wordDict = wordDict;
        this.wordIndex = wordIndex;
        this.grammarKeywords = grammarKeywords || {};
        this.vocabKeywords = vocabKeywords || {};
        this.cache = {};
    }

    static find(needle, haystack) {
        let beg = 0;
        let end = haystack.length - 1;

        while (beg < end) {
            let mi = Math.floor((beg + end) / 2);
            let i = haystack.lastIndexOf('\n', mi) + 1;

            let mis = haystack.substr(i, needle.length);
            if (needle < mis) {
                end = i - 1;
            } else if (needle > mis) {
                beg = haystack.indexOf('\n', mi + 1) + 1;
            } else {
                return haystack.substring(i, haystack.indexOf('\n', mi + 1));
            }
        }

        return null;
    }

    hasGrammarKeyword(keyword) {
        return this.grammarKeywords[keyword];
    }

    hasVocabKeyword(keyword) {
        return this.vocabKeywords[keyword];
    }

    wordSearch(word, max) {
        let entry = { data: [] };

        let dict = this.wordDict;
        let index = this.wordIndex;

        let maxTrim = max || 7;

        let count = 0;
        let maxLen = 0;

        WHILE:
        while (word.length > 0) {
            let ix = this.cache[word];
            if (!ix) {
                ix = ZhongwenDictionary.find(word + ',', index);
                if (!ix) {
                    this.cache[word] = [];
                    word = word.substr(0, word.length - 1);
                    continue;
                }
                ix = ix.split(',');
                this.cache[word] = ix;
            }

            for (let j = 1; j < ix.length; ++j) {
                let offset = ix[j];

                let dentry = dict.substring(offset, dict.indexOf('\n', offset));

                if (count >= maxTrim) {
                    entry.more = 1;
                    break WHILE;
                }

                ++count;
                if (maxLen === 0) {
                    maxLen = word.length;
                }

                entry.data.push([dentry, word]);
            }

            word = word.substr(0, word.length - 1);
        }

        if (entry.data.length === 0) {
            return null;
        }

        entry.matchLen = maxLen;
        return entry;
    }

    // Segment Chinese text into words
    // Returns array of {text, isWord, pinyin} objects
    segmentText(text) {
        const segments = [];
        let pos = 0;

        while (pos < text.length) {
            const remaining = text.substring(pos);

            // Try to find longest matching word
            const result = this.wordSearch(remaining, 1);

            if (result && result.matchLen > 0) {
                // Found a word - extract pinyin from dictionary entry
                let pinyin = '';
                if (result.data && result.data.length > 0) {
                    const dictEntry = result.data[0][0];
                    const pinyinMatch = dictEntry.match(/\[([^\]]+)\]/);
                    if (pinyinMatch) {
                        pinyin = pinyinMatch[1];
                    }
                }
                segments.push({
                    text: remaining.substring(0, result.matchLen),
                    isWord: true,
                    pinyin: pinyin
                });
                pos += result.matchLen;
            } else {
                // No word found, treat as single character
                segments.push({
                    text: remaining.substring(0, 1),
                    isWord: false,
                    pinyin: ''
                });
                pos += 1;
            }
        }

        return segments;
    }
}
