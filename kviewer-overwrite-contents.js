/**
 * ============================================================
 * FormBridge Indonesian Translation Runtime
 * ============================================================
 *
 * Generated: 2026-08-04T08:58:28.583Z
 * Source scan: formbridge-advanced-scan-result-2026-08-04T08-48-23-904Z.json
 * Source template: formbridge-translation-template-2026-08-04T08-48-35-375Z.json
 *
 * Tujuan:
 * - Menampilkan label, placeholder, opsi, teks umum, dan tombol dalam bahasa Indonesia.
 * - Menjaga value asli FormBridge/Kintone tetap apa adanya.
 * - Bekerja pada halaman public dan preview/private FormBridge versi terbaru.
 * - Aman terhadap render ulang, step form, conditional field, dan Headless UI dropdown.
 */

(function () {
  "use strict";

  const CONFIG = {
    name: "FB Indonesian Translator",
    version: "1.1.0",
    debug: false,
    mutationDelay: 24,
    periodicDelay: 1500,
    bootDelays: [0, 250, 750, 1500, 3000],
    fastRenderDelays: [0, 16, 40, 90, 180, 320],
    translatedAttribute: "data-fb-id-translated",
    originalTextAttribute: "data-fb-id-original-text",
    originalPlaceholderAttribute: "data-fb-id-original-placeholder"
  };

  const TRANSLATIONS = {
  "labelsByFieldCode": {
    "日本での経験_まだ働いている": {
      "source": "今もまだ働いている",
      "translation": "Masih bekerja sampai sekarang"
    }
  },
  "placeholdersByFieldCode": {
    "学歴_開始年": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    },
    "学歴_終了年": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    },
    "職歴_開始年": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    },
    "職歴_終了年": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    },
    "生年月日": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    },
    "日本での経験_いつから": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    },
    "日本での経験_いつまで": {
      "source": "年-月-日",
      "translation": "Tahun-Bulan-Tanggal"
    }
  },
  "descriptionsByFieldCode": {},
  "optionsByFieldCode": {
    "応募者との関係_3": {
      "fieldLabel": "Hubungan dengan Kandidat",
      "options": {
        "選択": {
          "translation": "Pilih",
          "originalValue": "選択"
        }
      }
    },
    "学歴_現在に至る": {
      "fieldLabel": "",
      "options": {
        "選択": {
          "translation": "Pilih",
          "originalValue": "選択"
        }
      }
    },
    "合格済みSSW試験": {
      "fieldLabel": "Bidang Sertifikat SSW",
      "options": {
        "養殖業": {
          "translation": "Budidaya Perikanan",
          "originalValue": "養殖業"
        }
      }
    },
    "宗教": {
      "fieldLabel": "Agama",
      "options": {
        "カトリック教": {
          "translation": "Katolik",
          "originalValue": "カトリック教"
        }
      }
    },
    "職歴_現在に至る": {
      "fieldLabel": "",
      "options": {
        "選択": {
          "translation": "Pilih",
          "originalValue": "選択"
        }
      }
    },
    "日本での経験_まだ働いている": {
      "fieldLabel": "Masih bekerja sampai sekarang",
      "options": {
        "今もまだ働いている": {
          "translation": "Masih bekerja sampai sekarang",
          "originalValue": "on"
        }
      }
    },
    "日本での経験_在留資格": {
      "fieldLabel": "Jenis visa apa yang Kamu gunakan sewaktu di Jepang?",
      "options": {
        "留学": {
          "translation": "Pelajar / Ryuugaku",
          "originalValue": "留学"
        },
        "特定活動": {
          "translation": "Aktivitas Khusus / Tokutei Katsudou",
          "originalValue": "特定活動"
        },
        "家族滞在": {
          "translation": "Tinggal Bersama Keluarga",
          "originalValue": "家族滞在"
        },
        "わからない": {
          "translation": "Tidak tahu",
          "originalValue": "わからない"
        }
      }
    },
    "日本での経験_都道府県": {
      "fieldLabel": "Kamu bekerja di prefektur apa?",
      "options": {
        "北海道": {
          "translation": "Hokkaido",
          "originalValue": "北海道"
        },
        "青森県": {
          "translation": "Aomori",
          "originalValue": "青森県"
        },
        "岩手県": {
          "translation": "Iwate",
          "originalValue": "岩手県"
        },
        "宮城県": {
          "translation": "Miyagi",
          "originalValue": "宮城県"
        },
        "秋田県": {
          "translation": "Akita",
          "originalValue": "秋田県"
        },
        "山形県": {
          "translation": "Yamagata",
          "originalValue": "山形県"
        },
        "福島県": {
          "translation": "Fukushima",
          "originalValue": "福島県"
        },
        "茨城県": {
          "translation": "Ibaraki",
          "originalValue": "茨城県"
        },
        "栃木県": {
          "translation": "Tochigi",
          "originalValue": "栃木県"
        },
        "群馬県": {
          "translation": "Gunma",
          "originalValue": "群馬県"
        },
        "埼玉県": {
          "translation": "Saitama",
          "originalValue": "埼玉県"
        },
        "千葉県": {
          "translation": "Chiba",
          "originalValue": "千葉県"
        },
        "東京都": {
          "translation": "Tokyo",
          "originalValue": "東京都"
        },
        "神奈川県": {
          "translation": "Kanagawa",
          "originalValue": "神奈川県"
        },
        "新潟県": {
          "translation": "Niigata",
          "originalValue": "新潟県"
        },
        "富山県": {
          "translation": "Toyama",
          "originalValue": "富山県"
        },
        "石川県": {
          "translation": "Ishikawa",
          "originalValue": "石川県"
        },
        "福井県": {
          "translation": "Fukui",
          "originalValue": "福井県"
        },
        "山梨県": {
          "translation": "Yamanashi",
          "originalValue": "山梨県"
        },
        "長野県": {
          "translation": "Nagano",
          "originalValue": "長野県"
        },
        "岐阜県": {
          "translation": "Gifu",
          "originalValue": "岐阜県"
        },
        "静岡県": {
          "translation": "Shizuoka",
          "originalValue": "静岡県"
        },
        "愛知県": {
          "translation": "Aichi",
          "originalValue": "愛知県"
        },
        "三重県": {
          "translation": "Mie",
          "originalValue": "三重県"
        },
        "滋賀県": {
          "translation": "Shiga",
          "originalValue": "滋賀県"
        },
        "京都府": {
          "translation": "Kyoto",
          "originalValue": "京都府"
        },
        "大阪府": {
          "translation": "Osaka",
          "originalValue": "大阪府"
        },
        "兵庫県": {
          "translation": "Hyogo",
          "originalValue": "兵庫県"
        },
        "奈良県": {
          "translation": "Nara",
          "originalValue": "奈良県"
        },
        "和歌山県": {
          "translation": "Wakayama",
          "originalValue": "和歌山県"
        },
        "鳥取県": {
          "translation": "Tottori",
          "originalValue": "鳥取県"
        },
        "島根県": {
          "translation": "Shimane",
          "originalValue": "島根県"
        },
        "岡山県": {
          "translation": "Okayama",
          "originalValue": "岡山県"
        },
        "広島県": {
          "translation": "Hiroshima",
          "originalValue": "広島県"
        },
        "山口県": {
          "translation": "Yamaguchi",
          "originalValue": "山口県"
        },
        "徳島県": {
          "translation": "Tokushima",
          "originalValue": "徳島県"
        },
        "香川県": {
          "translation": "Kagawa",
          "originalValue": "香川県"
        },
        "愛媛県": {
          "translation": "Ehime",
          "originalValue": "愛媛県"
        },
        "高知県": {
          "translation": "Kochi",
          "originalValue": "高知県"
        },
        "福岡県": {
          "translation": "Fukuoka",
          "originalValue": "福岡県"
        },
        "佐賀県": {
          "translation": "Saga",
          "originalValue": "佐賀県"
        },
        "長崎県": {
          "translation": "Nagasaki",
          "originalValue": "長崎県"
        },
        "熊本県": {
          "translation": "Kumamoto",
          "originalValue": "熊本県"
        },
        "大分県": {
          "translation": "Oita",
          "originalValue": "大分県"
        },
        "宮崎県": {
          "translation": "Miyazaki",
          "originalValue": "宮崎県"
        },
        "鹿児島県": {
          "translation": "Kagoshima",
          "originalValue": "鹿児島県"
        },
        "沖縄県": {
          "translation": "Okinawa",
          "originalValue": "沖縄県"
        }
      }
    },
    "日本での経験_特定技能分野": {
      "fieldLabel": "Kamu bekerja sebagai Tokutei Ginou di bidang apa?",
      "options": {
        "造船・舶用業": {
          "translation": "Pembuatan Kapal dan Industri Peralatan Kapal",
          "originalValue": "造船・舶用業"
        }
      }
    },
    "日本で働いた経験": {
      "fieldLabel": "Apakah Kamu pernah/sedang bekerja/tinggal di Jepang?",
      "options": {
        "ない": {
          "translation": "Tidak pernah",
          "originalValue": "ない"
        },
        "技能実習で働いた": {
          "translation": "Pernah bekerja sebagai peserta magang teknis",
          "originalValue": "技能実習で働いた"
        },
        "特定技能で働いた": {
          "translation": "Pernah bekerja dengan visa Tokutei Ginou",
          "originalValue": "特定技能で働いた"
        },
        "留学など他の在留資格で滞在した": {
          "translation": "Pernah tinggal dengan status tinggal lain seperti pelajar",
          "originalValue": "留学など他の在留資格で滞在した"
        }
      }
    },
    "免許証の種類": {
      "fieldLabel": "Apa jenis SIM yang Kamu miliki?",
      "options": {
        "SIM A / 普通・順中型自動車": {
          "translation": "SIM A / Mobil biasa dan truk menengah ringan",
          "originalValue": "SIM A / 普通・順中型自動車"
        },
        "SIM B1・B2 / 中型・大型自動車": {
          "translation": "SIM B1/B2 / Kendaraan menengah dan besar",
          "originalValue": "SIM B1・B2 / 中型・大型自動車"
        }
      }
    }
  },
  "globalOptionTexts": {
    "選択": "Pilih",
    "養殖業": "Budidaya Perikanan",
    "カトリック教": "Katolik",
    "今もまだ働いている": "Masih bekerja sampai sekarang",
    "留学": "Pelajar",
    "特定活動": "Aktivitas Khusus",
    "家族滞在": "Tinggal Bersama Keluarga",
    "わからない": "Tidak tahu",
    "北海道": "Hokkaido",
    "青森県": "Aomori",
    "岩手県": "Iwate",
    "宮城県": "Miyagi",
    "秋田県": "Akita",
    "山形県": "Yamagata",
    "福島県": "Fukushima",
    "茨城県": "Ibaraki",
    "栃木県": "Tochigi",
    "群馬県": "Gunma",
    "埼玉県": "Saitama",
    "千葉県": "Chiba",
    "東京都": "Tokyo",
    "神奈川県": "Kanagawa",
    "新潟県": "Niigata",
    "富山県": "Toyama",
    "石川県": "Ishikawa",
    "福井県": "Fukui",
    "山梨県": "Yamanashi",
    "長野県": "Nagano",
    "岐阜県": "Gifu",
    "静岡県": "Shizuoka",
    "愛知県": "Aichi",
    "三重県": "Mie",
    "滋賀県": "Shiga",
    "京都府": "Kyoto",
    "大阪府": "Osaka",
    "兵庫県": "Hyogo",
    "奈良県": "Nara",
    "和歌山県": "Wakayama",
    "鳥取県": "Tottori",
    "島根県": "Shimane",
    "岡山県": "Okayama",
    "広島県": "Hiroshima",
    "山口県": "Yamaguchi",
    "徳島県": "Tokushima",
    "香川県": "Kagawa",
    "愛媛県": "Ehime",
    "高知県": "Kochi",
    "福岡県": "Fukuoka",
    "佐賀県": "Saga",
    "長崎県": "Nagasaki",
    "熊本県": "Kumamoto",
    "大分県": "Oita",
    "宮崎県": "Miyazaki",
    "鹿児島県": "Kagoshima",
    "沖縄県": "Okinawa",
    "造船・舶用業": "Pembuatan Kapal dan Industri Peralatan Kapal",
    "ない": "Tidak pernah",
    "技能実習で働いた": "Pernah bekerja sebagai peserta magang teknis",
    "特定技能で働いた": "Pernah bekerja dengan visa Tokutei Ginou",
    "留学など他の在留資格で滞在した": "Pernah tinggal dengan status tinggal lain seperti pelajar",
    "SIM A / 普通・順中型自動車": "SIM A / Mobil biasa dan truk menengah ringan",
    "SIM B1・B2 / 中型・大型自動車": "SIM B1/B2 / Kendaraan menengah dan besar"
  },
  "genericTexts": {
    "一時保存": "Simpan sementara",
    "戻る": "Kembali",
    "次へ": "Berikutnya",
    "プレビュー中": "Sedang preview",
    "ログインしている管理者のみ閲覧できます。": "Hanya admin yang sedang login yang dapat melihat halaman ini.",
    "入力を再開しますか？": "Lanjutkan pengisian?",
    "入力の途中で一時保存したデータが存在します。一時保存した時点から入力を再開しますか？": "Ada data yang tersimpan sementara saat pengisian. Lanjutkan dari titik simpan tersebut?",
    "初めから": "Mulai dari awal",
    "再開": "Lanjutkan",
    "選択": "Pilih",
    "ファイルを選択": "Pilih file",
  },
  "buttons": {
    "一時保存": "Simpan sementara",
    "戻る": "Kembali",
    "次へ": "Berikutnya",
    "シートを折りたたむ": "Tutup panel",
    "初めから": "Mulai dari awal",
    "再開": "Lanjutkan",
    "選択": "Pilih",
    "ファイルを選択": "Pilih file",
  }
};
  const KNOWN_FIELD_CODES = new Set([
  "Email",
  "RespondID",
  "応募前の本人確認事項",
  "身長",
  "体重",
  "刺青の有無",
  "利き手",
  "食物禁忌",
  "学歴_開始年",
  "学歴_終了年",
  "学歴_現在に至る",
  "学歴_区分",
  "学歴_学校名",
  "職歴_開始年",
  "職歴_終了年",
  "職歴_現在に至る",
  "職歴_会社名",
  "職歴_職種",
  "在留資格",
  "複数_日本語資格",
  "合格済みSSW試験",
  "日本で働いた経験",
  "日本での経験_都道府県",
  "日本での経験_まだ働いている",
  "日本での経験_いつから",
  "日本での経験_いつまで",
  "日本での経験_仕事内容",
  "名前",
  "生年月日",
  "性別",
  "宗教",
  "婚姻",
  "電話番号",
  "現在の居住国",
  "最寄りの国際空港",
  "自動車免許の有無",
  "免許証の発行国",
  "免許証の種類",
  "名前_応募者の関係者",
  "応募者との関係",
  "関係者の電話番号",
  "名前_応募者の関係者_2",
  "応募者との関係_2",
  "関係者の電話番号_2",
  "名前_応募者の関係者_3",
  "応募者との関係_3",
  "関係者の電話番号_3",
  "日本での経験_特定技能分野",
  "日本での経験_在留資格",
  "日本での経験_アルバイトの経験",
  "日本での経験_アルバイトの内容",
  "過去の入出国歴",
  "難民ビザを申請したことある",
  "Drop_down_3",
  "Text_0"
]);
  const JAPANESE_REGEX =
    /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u;

  const state = {
    observer: null,
    timer: null,
    runCount: 0,
    lastMissingLog: ""
  };

  function isAllowedPage() {
    return location.hostname === "formbridge.kintoneapp.com";
  }

  if (!isAllowedPage()) {
    return;
  }

  function log(...args) {
    if (!CONFIG.debug) return;
    console.log("%c[" + CONFIG.name + "]", "background:#0f766e;color:#fff;font-weight:700;padding:2px 7px;border-radius:4px", ...args);
  }

  function normalizeText(value) {
    return String(value || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function containsJapanese(value) {
    return JAPANESE_REGEX.test(normalizeText(value));
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) return false;
    if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 || rect.height > 0;
  }

  function ownTextNodes(element) {
    return Array.from(element.childNodes).filter((node) => {
      return node.nodeType === Node.TEXT_NODE && normalizeText(node.textContent);
    });
  }

  function setTextNode(node, translation) {
    const current = normalizeText(node.textContent);
    if (!current || current === translation) return false;
    if (!node.__fbOriginalText) node.__fbOriginalText = current;
    node.textContent = node.textContent.replace(current, translation);
    return true;
  }

  function queryAllIncludingRoot(root, selector) {
    if (!root) return [];

    const results = [];
    if (root instanceof Element && root.matches(selector)) {
      results.push(root);
    }

    if (root.querySelectorAll) {
      results.push(...root.querySelectorAll(selector));
    }

    return results;
  }

  function getFieldCodeFromElement(element) {
    if (!(element instanceof Element)) return "";

    const direct = element.closest("[data-field-code]");
    if (direct) {
      const code = normalizeText(direct.getAttribute("data-field-code") || direct.dataset.fieldCode);
      if (code) return code;
    }

    const control = element.closest("input, textarea, select, [role='combobox'], [role='listbox'], [role='radiogroup']");
    if (control) {
      const candidates = [
        control.getAttribute("name"),
        control.getAttribute("id"),
        control.getAttribute("data-field-code")
      ].map(normalizeText);
      for (const candidate of candidates) {
        if (KNOWN_FIELD_CODES.has(candidate)) return candidate;
      }
    }

    let current = element.parentElement;
    let depth = 0;
    while (current && depth < 8) {
      const controls = current.querySelectorAll("input[name], textarea[name], select[name], input[id], textarea[id], select[id]");
      for (const item of controls) {
        const name = normalizeText(item.getAttribute("name"));
        const id = normalizeText(item.getAttribute("id"));
        if (KNOWN_FIELD_CODES.has(name)) return name;
        if (KNOWN_FIELD_CODES.has(id)) return id;
      }
      current = current.parentElement;
      depth += 1;
    }

    return "";
  }

  function getActiveFieldCodeForFloatingOption(option) {
    const direct = getFieldCodeFromElement(option);
    if (direct) return direct;

    const optionText = normalizeText(option.innerText || option.textContent);
    const matches = [];
    Object.entries(TRANSLATIONS.optionsByFieldCode).forEach(([fieldCode, field]) => {
      if (field.options && field.options[optionText]) matches.push(fieldCode);
    });

    if (matches.length === 1) return matches[0];

    const active = document.activeElement;
    const activeCode = getFieldCodeFromElement(active);
    if (activeCode && matches.includes(activeCode)) return activeCode;

    const expandedButton = document.querySelector("[aria-expanded='true']");
    const expandedCode = getFieldCodeFromElement(expandedButton);
    if (expandedCode && matches.includes(expandedCode)) return expandedCode;

    return matches[0] || "";
  }

  function optionTranslation(fieldCode, text) {
    const normalized = normalizeText(text);
    const fieldMap = TRANSLATIONS.optionsByFieldCode[fieldCode];
    if (fieldMap && fieldMap.options && fieldMap.options[normalized]) {
      return fieldMap.options[normalized].translation;
    }
    if (TRANSLATIONS.genericTexts[normalized]) {
      return TRANSLATIONS.genericTexts[normalized];
    }
    if (TRANSLATIONS.globalOptionTexts[normalized]) {
      return TRANSLATIONS.globalOptionTexts[normalized];
    }
    return "";
  }

  function genericTranslation(text) {
    const normalized = normalizeText(text);
    return TRANSLATIONS.genericTexts[normalized] || "";
  }

  function buttonTranslation(text) {
    const normalized = normalizeText(text);
    return TRANSLATIONS.buttons[normalized] || TRANSLATIONS.genericTexts[normalized] || "";
  }

  function translateLabelAndDescription(fieldCode, root) {
    const labelEntry = TRANSLATIONS.labelsByFieldCode[fieldCode];
    if (labelEntry) {
      root.querySelectorAll("label, legend, [class*='label'], [class*='Label']").forEach((element) => {
        const text = normalizeText(element.innerText || element.textContent);
        if (text === labelEntry.source || text.includes(labelEntry.source)) {
          ownTextNodes(element).forEach((node) => setTextNode(node, labelEntry.translation));
        }
      });
    }

    const descEntry = TRANSLATIONS.descriptionsByFieldCode[fieldCode];
    if (descEntry) {
      root.querySelectorAll("p, small, div, span").forEach((element) => {
        const text = normalizeText(element.innerText || element.textContent);
        if (text === descEntry.source) {
          ownTextNodes(element).forEach((node) => setTextNode(node, descEntry.translation));
        }
      });
    }
  }

  function translatePlaceholders(root) {
    root.querySelectorAll("input, textarea").forEach((element) => {
      const fieldCode = getFieldCodeFromElement(element);
      const entry = TRANSLATIONS.placeholdersByFieldCode[fieldCode];
      if (!entry) return;

      const current = normalizeText(element.getAttribute("placeholder"));
      if (current !== entry.source && current !== entry.translation) return;

      if (!element.hasAttribute(CONFIG.originalPlaceholderAttribute)) {
        element.setAttribute(CONFIG.originalPlaceholderAttribute, current);
      }
      element.setAttribute("placeholder", entry.translation);
    });
  }

  function translateNativeOptions(root) {
    queryAllIncludingRoot(root, "select").forEach((select) => {
      const fieldCode = getFieldCodeFromElement(select);
      Array.from(select.options).forEach((option) => {
        const source = normalizeText(option.textContent);
        const translation = optionTranslation(fieldCode, source);
        if (!translation || source === translation) return;

        if (!option.hasAttribute(CONFIG.originalTextAttribute)) {
          option.setAttribute(CONFIG.originalTextAttribute, source);
        }
        option.textContent = translation;
      });
    });
  }

  function translateChoiceLabels(root) {
    queryAllIncludingRoot(root, "input[type='radio'], input[type='checkbox']").forEach((input) => {
      const fieldCode = getFieldCodeFromElement(input);
      const label = input.closest("label");
      if (!label) return;

      const text = normalizeText(label.innerText || label.textContent);
      const translation = optionTranslation(fieldCode, text);
      if (!translation || text === translation) return;

      ownTextNodes(label).forEach((node) => setTextNode(node, translation));
      label.querySelectorAll("span, div").forEach((child) => {
        if (normalizeText(child.innerText || child.textContent) === text) {
          ownTextNodes(child).forEach((node) => setTextNode(node, translation));
        }
      });
    });
  }

  function translateHeadlessOptions(root) {
    queryAllIncludingRoot(root, "[role='option']").forEach((option) => {
      const text = normalizeText(option.innerText || option.textContent);
      const fieldCode = getActiveFieldCodeForFloatingOption(option);
      const translation = optionTranslation(fieldCode, text);
      if (!translation || text === translation) return;

      if (!option.hasAttribute(CONFIG.originalTextAttribute)) {
        option.setAttribute(CONFIG.originalTextAttribute, text);
      }
      ownTextNodes(option).forEach((node) => setTextNode(node, translation));
      option.querySelectorAll("span, div").forEach((child) => {
        if (normalizeText(child.innerText || child.textContent) === text) {
          ownTextNodes(child).forEach((node) => setTextNode(node, translation));
        }
      });
    });
  }

  function translateComboboxButtons(root) {
    queryAllIncludingRoot(root, "button, [role='combobox']").forEach((element) => {
      const text = normalizeText(element.innerText || element.textContent || element.getAttribute("aria-label"));
      if (!text) return;

      const fieldCode = getFieldCodeFromElement(element);
      const translation =
        optionTranslation(fieldCode, text) ||
        buttonTranslation(text);

      if (!translation || text === translation) return;

      if (element.childNodes.length === 1 && element.firstChild.nodeType === Node.TEXT_NODE) {
        setTextNode(element.firstChild, translation);
        return;
      }

      ownTextNodes(element).forEach((node) => setTextNode(node, translation));
      element.querySelectorAll("span, div").forEach((child) => {
        if (normalizeText(child.innerText || child.textContent) === text) {
          ownTextNodes(child).forEach((node) => setTextNode(node, translation));
        }
      });

      if (element.getAttribute("aria-label") === text) {
        element.setAttribute("aria-label", translation);
      }
    });
  }

  function translateGenericText(root) {
    const selector = [
      "p",
      "span",
      "div",
      "strong",
      "small",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6"
    ].join(",");

    queryAllIncludingRoot(root, selector).forEach((element) => {
      if (!isElementVisible(element)) return;
      if (element.closest("select, option, script, style")) return;

      const nodes = ownTextNodes(element);
      nodes.forEach((node) => {
        const source = normalizeText(node.textContent);
        const translation = genericTranslation(source);
        if (translation) setTextNode(node, translation);
      });
    });
  }

  function translateFieldRoots(root) {
    Object.keys(TRANSLATIONS.labelsByFieldCode).forEach((fieldCode) => {
      const direct = queryAllIncludingRoot(root, '[data-field-code="' + CSS.escape(fieldCode) + '"]')[0];
      if (direct) translateLabelAndDescription(fieldCode, direct);
    });

    queryAllIncludingRoot(root, "input, textarea, select, [role='combobox']").forEach((control) => {
      const fieldCode = getFieldCodeFromElement(control);
      if (!fieldCode) return;
      const container = control.closest("[data-field-code]") || control.closest("label") || control.parentElement;
      if (container) translateLabelAndDescription(fieldCode, container);
    });
  }

  function collectMissingJapanese(root) {
    const missing = new Set();
    queryAllIncludingRoot(root, "option, [role='option'], button, label, span, p, div").forEach((element) => {
      if (!isElementVisible(element)) return;
      const text = normalizeText(element.innerText || element.textContent);
      if (!text || text.length > 80 || !containsJapanese(text)) return;
      if (genericTranslation(text) || buttonTranslation(text)) return;
      const fieldCode = getFieldCodeFromElement(element);
      if (optionTranslation(fieldCode, text)) return;
      missing.add(text);
    });

    const signature = Array.from(missing).sort().join("|");
    if (signature && signature !== state.lastMissingLog) {
      state.lastMissingLog = signature;
      log("Teks Jepang belum ada di kamus:", Array.from(missing));
    }
  }

  function applyTranslations(reason, targetRoot, options) {
    state.runCount += 1;
    const root = targetRoot || document.body;
    if (!root) return;
    const shouldCollectMissing = !options || options.collectMissing !== false;

    translateFieldRoots(root);
    translatePlaceholders(root);
    translateNativeOptions(root);
    translateChoiceLabels(root);
    translateHeadlessOptions(root);
    translateComboboxButtons(root);
    translateGenericText(root);
    if (shouldCollectMissing) {
      collectMissingJapanese(root);
    }

    if (state.runCount <= 5) {
      log("Terjemahan diterapkan", { reason, runCount: state.runCount });
    }
  }

  function schedule(reason) {
    window.clearTimeout(state.timer);
    state.timer = window.setTimeout(() => applyTranslations(reason), CONFIG.mutationDelay);
  }

  function applyFastTranslations(reason, root) {
    applyTranslations("fast-" + reason, root || document.body, {
      collectMissing: false
    });
  }

  function scheduleFastPasses(reason) {
    CONFIG.fastRenderDelays.forEach((delay) => {
      window.setTimeout(() => applyFastTranslations(reason + "-" + delay), delay);
    });
  }

  function triggerFastTranslation(reason) {
    applyFastTranslations(reason);
    scheduleFastPasses(reason);
    schedule(reason);
  }

  function translateMutationTargets(mutations) {
    const targets = new Set();

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          targets.add(node);
          return;
        }

        if (node.parentElement) {
          targets.add(node.parentElement);
        }
      });

      if (mutation.type === "attributes" && mutation.target instanceof Element) {
        targets.add(mutation.target);
      }
    });

    targets.forEach((target) => applyFastTranslations("mutation-target", target));
  }

  function installEventHooks() {
    document.addEventListener("pointerdown", () => triggerFastTranslation("pointerdown"), true);
    document.addEventListener("click", () => triggerFastTranslation("click"), true);
    document.addEventListener("input", () => triggerFastTranslation("input"), true);
    document.addEventListener("change", () => triggerFastTranslation("change"), true);
    document.addEventListener("focusin", () => triggerFastTranslation("focusin"), true);
    document.addEventListener("keyup", () => triggerFastTranslation("keyup"), true);
  }

  function init() {
    if (!document.body) {
      window.setTimeout(init, 100);
      return;
    }

    if (!window.CSS || typeof window.CSS.escape !== "function") {
      window.CSS = window.CSS || {};
      window.CSS.escape = function (value) {
        return String(value).replace(/([ #;?%&,.+*~\\':"!^$[\]()=>|/@])/g, "\\$1");
      };
    }

    state.observer = new MutationObserver((mutations) => {
      translateMutationTargets(mutations);
      scheduleFastPasses("mutation");
      schedule("mutation");
    });
    state.observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [
        "placeholder",
        "aria-expanded",
        "aria-selected",
        "aria-checked",
        "data-headlessui-state",
        "class"
      ]
    });

    installEventHooks();
    CONFIG.bootDelays.forEach((delay) => {
      window.setTimeout(() => applyTranslations("boot-" + delay), delay);
    });
    window.setInterval(() => applyTranslations("periodic"), CONFIG.periodicDelay);

    log("Aktif di FormBridge", {
      version: CONFIG.version,
      fields: Object.keys(TRANSLATIONS.optionsByFieldCode).length
    });
  }

  init();
})();
