// SPDX-License-Identifier: GPL-2.0-or-later
// Copyright (C) 2025 Daniel Sangorrin
//
// Youku Dual Subtitle - Background Service Worker
// Dictionary loading and word segmentation service
//
// ---
//
// Based on Zhongwen Chinese-English Pop-Up Dictionary
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

importScripts('dict.js');

let dict = null;

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (message.type === 'search') {
        // Perform dictionary lookup
        search(message.text).then(response => {
            sendResponse(response);
        }).catch(error => {
            console.error('[Background] Search error:', error);
            sendResponse(null);
        });
        return true; // Keep channel open for async response
    }

    if (message.type === 'segment') {
        segmentText(message.text).then(response => {
            sendResponse(response);
        }).catch(error => {
            console.error('[Background] Segmentation error:', error);
            sendResponse({ segments: [] });
        });
        return true; // Keep channel open for async response
    }
});

async function search(text) {
    if (!dict) {
        dict = await loadDictionary();
    }

    const entry = dict.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dict.hasGrammarKeyword(word) && (entry.matchLen === word.length)) {
                entry.grammar = { keyword: word, index: i };
            }
            if (dict.hasVocabKeyword(word) && (entry.matchLen === word.length)) {
                entry.vocab = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

async function segmentText(text) {
    if (!dict) {
        dict = await loadDictionary();
    }

    const segments = dict.segmentText(text);
    return { segments };
}

async function loadDictionary() {
    const [wordDict, wordIndex, grammarKeywords, vocabKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords, vocabKeywords);
}

async function loadDictData() {
    const wordDict = fetch(chrome.runtime.getURL("data/cedict_ts.u8"))
        .then(r => r.text());
    const wordIndex = fetch(chrome.runtime.getURL("data/cedict.idx"))
        .then(r => r.text());
    const grammarKeywords = fetch(chrome.runtime.getURL("data/grammarKeywordsMin.json"))
        .then(r => r.json());
    const vocabKeywords = fetch(chrome.runtime.getURL("data/vocabularyKeywordsMin.json"))
        .then(r => r.json());

    return Promise.all([wordDict, wordIndex, grammarKeywords, vocabKeywords]);
}

