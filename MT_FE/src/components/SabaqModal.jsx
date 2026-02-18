import React, { useEffect, useMemo, useState } from 'react';
import { HOST } from '../api';

// ---------- helpers ----------
const countArabicLetters = (input) => {
  if (!input) return 0;
  // strip diacritics
  let s = input.replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '');
  // strip tatweel
  s = s.replace(/\u0640/g, '');
  // keep Arabic letters only
  s = s.replace(/[^ء-ي؀-ۿ]/g, '');
  return s.length;
};

const fetchPageAyahs = async (pageNumber) => {
  const res = await fetch(`https://api.alquran.cloud/v1/page/${pageNumber}/quran-uthmani`);
  const json = await res.json();
  if (!res.ok || !json?.data?.ayahs) throw new Error('Failed to fetch mushaf page');
  return json.data.ayahs.map(a => ({
    surah: a.surah.number,
    verse: a.numberInSurah,
    text: a.text,
    letters: countArabicLetters(a.text),
  }));
};

/** Split a page into 5 balanced sections (by letters), each section ends at a verse. */
// Divide a page into up to 5 balanced, NON-EMPTY sections by letters.
// Guarantees every section ends on a verse and leaves at least 1 ayah
// for the remaining sections when possible. If the page has <5 ayahs,
// you'll naturally get fewer than 5 sections (never empty ones).
const divideIntoFiveSections = (ayahs) => {
  const N = ayahs?.length || 0;
  if (N === 0) return [];

  const totalLetters = ayahs.reduce((s, a) => s + a.letters, 0);

  const sections = [];
  let start = 0;            // start index of current section
  let usedLetters = 0;      // letters already assigned to previous sections

  // Decide the first 4 cut points; the 5th section is the remainder
  for (let s = 1; s <= 4 && start < N; s++) {
    let remainingAyahs = N - start;
    let remainingSections = 5 - s; // how many sections will remain AFTER we cut
    if (remainingAyahs <= remainingSections) break; // must leave 1 ayah for each remaining section

    // Dynamic target based on remaining letters and remaining sections (including this one)
    const lettersLeft = totalLetters - usedLetters;
    const target = lettersLeft / (remainingSections + 1);

    let end = start;
    let sum = ayahs[end].letters;

    // extend until we hit target, but ensure we leave at least 1 ayah per remaining section
    while (
      end + 1 < N &&
      sum < target &&
      (N - (end + 1)) > remainingSections // keep at least 1 ayah for each remaining section
    ) {
      end++;
      sum += ayahs[end].letters;
    }

    sections.push({ ayahs: ayahs.slice(start, end + 1), letters: sum });
    usedLetters += sum;
    start = end + 1;
  }

  // Remainder becomes the last section (if any)
  if (start < N) {
    const tail = ayahs.slice(start);
    sections.push({
      ayahs: tail,
      letters: tail.reduce((s, a) => s + a.letters, 0),
    });
  }

  // Cap to at most 5 sections
  return sections.slice(0, 5);
};

const findSectionIndexByRange = (sections, surah, begin, end) => {
  if (!sections?.length) return 0;
  for (let i = 0; i < sections.length; i++) {
    const ay = sections[i].ayahs;
    if (!ay.length) continue;
    const first = ay[0];
    const last = ay[ay.length - 1];
    if (first.surah === surah && first.verse <= begin && last.verse >= end) {
      return i; // 0-based
    }
  }
  return 0; // fallback
};

// ---------- component ----------
const SabaqModal = ({ isOpen, onClose, userId }) => {
  const [formData, setFormData] = useState({
    chapter_number: '',
    chapter_name: '',
    page: '',
    section: '',
    verse: '',
    number_of_readings: 0,
    complete_memorization: false,
    murajaah_20_times: 0,
  });

  const [showVerses, setShowVerses] = useState(false);
  const [verses, setVerses] = useState([]);
  const [totalLetters, setTotalLetters] = useState(0);
  const [versePages, setVersePages] = useState([]);
  const [pageDetails, setPageDetails] = useState({ totalLettersOnPage: 0, sections: [] });
  const [loadingAuto, setLoadingAuto] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [pageChapterRange, setPageChapterRange] = useState(null);

  const withUserHeaders = (headers = {}) => ({
    ...headers,
    'x-user-id': String(userId),
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]:
        type === 'checkbox' ? checked :
        name === 'number_of_readings' || name === 'murajaah_20_times'
          ? Number(value)
          : value
    }));
  };

  // Load latest sabaq to rehydrate UI (✅ user-aware)
  useEffect(() => {
    if (!isOpen) return;
    if (!userId) {
      setErrorText('User not logged in. Please login again.');
      return;
    }

    (async () => {
      try {
        const r = await fetch(`${HOST}/murajaah/sabaqtracker/latest`, {
          headers: withUserHeaders(),
        });
        const data = await r.json().catch(() => null);

        if (r.ok && data) {
          setFormData(prev => ({
            ...prev,
            chapter_number: data.chapter_number ? Math.floor(data.chapter_number) : '',
            chapter_name: data.chapter_name ?? '',
            page: data.page ?? '',
            section: data.section ?? '',
            verse: data.verse ?? '',
            number_of_readings: data.number_of_readings ?? 0,
            complete_memorization: !!data.complete_memorization,
            murajaah_20_times: Number.isFinite(data.murajaah_20_times) ? data.murajaah_20_times : 0,
          }));

          setTimeout(() => autoPopulateFromInputs(
            data.chapter_number,
            data.page,
            data.section,
            data.verse
          ), 0);
        }
      } catch (e) {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, userId]);

  // auto-populate when user changes chapter/page/section
  useEffect(() => {
    if (!isOpen) return;
    if (!formData.chapter_number || !formData.page || !formData.section) return;
    // If user typed all three, derive range
    autoPopulateFromInputs(formData.chapter_number, formData.page, formData.section);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.chapter_number, formData.page, formData.section]);

  const autoPopulateFromInputs = async (chapterNum, pageNum, sectionIdx, existingVerseRange) => {
  try {
    setLoadingAuto(true);
    setErrorText('');

    // 1️⃣ Fetch page + build sections (non-empty only)
    const pageAyahs = await fetchPageAyahs(pageNum);
    const sectionsAll = divideIntoFiveSections(pageAyahs); // returns up to 5 sections
    const sections = sectionsAll.filter(sec => sec.ayahs.length);
    const totalLettersOnPage = pageAyahs.reduce((s, a) => s + a.letters, 0);

    // 2️⃣ Filter ayahs on this page belonging to the selected chapter
    const chapterNumStr = String(chapterNum);
    const filteredBySurah = pageAyahs.filter(a => String(a.surah) === chapterNumStr);

    // 3️⃣ Fetch chapter name
    let chapterName = '';
    if (filteredBySurah.length) {
      const nameRes = await fetch(`https://api.alquran.cloud/v1/surah/${chapterNum}`);
      const nameJson = await nameRes.json();
      if (nameRes.ok && nameJson?.data?.englishName) {
        chapterName = nameJson.data.englishName;
      }
    }

    // 4️⃣ Determine selected sections
    let selected = parseSections(sectionIdx);
    if (!selected.length) selected = [1]; // default if none selected

    // Clamp within range
    const maxAvailable = Math.max(1, sections.length);
    selected = selected.filter(n => n >= 1 && n <= maxAvailable);

    // Ensure contiguity if multiple selected
    if (!isContiguous(selected)) {
      const min = selected[0];
      const max = selected[selected.length - 1];
      selected = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    }

    // 5️⃣ Compute verse range across selected sections for this surah
    let begin = 1, end = 1;
    const ayInChosenSections = [];

    selected.forEach(idx => {
      const sec = sections[idx - 1];
      if (!sec?.ayahs?.length) return;
      sec.ayahs.forEach(a => {
        if (String(a.surah) === chapterNumStr) ayInChosenSections.push(a);
      });
    });

    if (ayInChosenSections.length) {
      begin = ayInChosenSections[0].verse;
      end = ayInChosenSections[ayInChosenSections.length - 1].verse;
    } else if (filteredBySurah.length) {
      begin = filteredBySurah[0].verse;
      end = filteredBySurah[filteredBySurah.length - 1].verse;
    }

    // 6️⃣ Save back into formData
    const sectionStr = selected.join(',');
    setFormData(prev => ({
      ...prev,
      chapter_number: Math.floor(chapterNum),
      chapter_name: chapterName || prev.chapter_name,
      page: String(pageNum),
      section: sectionStr,
      verse: `${begin} - ${end}`,
    }));

    // 7️⃣ Display verse range preview
    await showVersesForRange(chapterNum, begin, end, pageNum, totalLettersOnPage, sections);
    setPageDetails({ totalLettersOnPage, sections });

  } catch (e) {
    console.error(e);
    setErrorText('Failed to auto-populate from inputs. Please check chapter/page/section.');
  } finally {
    setLoadingAuto(false);
  }
};



  const showVersesForRange = async (surah, beginning, ending, pageNumFromInput, totalLettersOnPage, sections) => {
    const url = `${HOST}/murajaah/surah/${surah}?beginning=${beginning}&ending=${ending}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!res.ok || !data?.data?.ayahs?.length) {
      setShowVerses(false);
      setVerses([]);
      setTotalLetters(0);
      setVersePages([]);
      return;
    }

    const mapped = data.data.ayahs.map(ayah => ({
      text: ayah.text,
      numberInSurah: ayah.numberInSurah,
      page: ayah.page,
      letterCount: countArabicLetters(ayah.text),
    }));

    const total = mapped.reduce((s, a) => s + a.letterCount, 0);
    const pages = [...new Set(mapped.map(a => a.page))];

    setVerses(mapped);
    setTotalLetters(total);
    setVersePages(pages);
    setShowVerses(true);

    // if single page, ensure pageDetails is aligned
    if (pages.length === 1) {
  const pageAyahs = await fetchPageAyahs(pages[0]);
  const lettersPage = pageAyahs.reduce((s, a) => s + a.letters, 0);
  setPageDetails({ totalLettersOnPage: lettersPage, sections: divideIntoFiveSections(pageAyahs) });

  // 🔸 compute begin/end verse for the selected surah on this page
  const chapterNumStr = String(surah);
  const onThisPageForSurah = pageAyahs.filter(a => String(a.surah) === chapterNumStr);
  if (onThisPageForSurah.length) {
    const beginV = onThisPageForSurah[0].verse;
    const endV   = onThisPageForSurah[onThisPageForSurah.length - 1].verse;
    setPageChapterRange({ page: pages[0], begin: beginV, end: endV });
  } else {
    setPageChapterRange(null);
  }
} else {
  setPageDetails({ totalLettersOnPage: 0, sections: [] });
  setPageChapterRange(null);
}

  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorText('');

    if (!userId) {
      setErrorText('User not logged in. Please login again.');
      return;
    }

    try {
      // ✅ include user_id in body (optional, but ok)
      const payload = { ...formData, user_id: userId };

      const res = await fetch(`${HOST}/murajaah/sabaqtracker/add`, {
        method: 'POST',
        headers: withUserHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (res.ok) {
        alert('Saved successfully!');
      } else {
        alert(data?.message || 'Error saving');
      }
    } catch (err) {
      setErrorText('Network error while saving.');
    }
  };

  // Parse "section" string -> [1,2,...]
// const parseSections = (val) =>
//   String(val || '')
//     .split(',')
//     .map(s => Number(String(s).trim()))
//     .filter(Boolean)
//     .sort((a,b) => a - b);

// Build "1,2,...,k"
const buildSequential = (k) => Array.from({length: Math.max(0, k)}, (_, i) => String(i+1)).join(',');

// If user toggles n: checking -> 1..n, unchecking -> 1..(n-1)
const toggleSequential = (currentStr, n, checked) => {
  const k = checked ? n : (n - 1);
  return buildSequential(k);
};

// turn "1,3,4" -> [1,3,4]
const parseSections = (val) =>
  String(val || '')
    .split(',')
    .map(s => Number(String(s).trim()))
    .filter(Boolean)
    .sort((a, b) => a - b);

const isContiguous = (arr) =>
  arr.length <= 1 ? true : (arr[arr.length - 1] - arr[0] + 1) === arr.length;

const toRangeString = (min, max) =>
  Array.from({ length: max - min + 1 }, (_, i) => String(min + i)).join(',');


  if (!isOpen) return null;

  return (
    <div style={modalStyles} onClick={onClose}>
      <div style={modalContentStyles} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ borderBottom: '2px solid #84a59d', paddingBottom: '10px' }}>Add Sabaq Record</h2>

        {(!userId) && (
          <div style={{ marginBottom: 10, color: '#b00020', fontWeight: 700 }}>
            User not logged in. Please login again.
          </div>
        )}

        

        {/* Inputs that drive auto-population */}
        {/* Inputs that drive auto-population (stacked vertically & centered) */}
<div style={inputsContainer}>
  <div style={inputsStack}>
    <div>
      <label style={labelStyles}>Chapter Number</label>
      <input
        type="number"
        name="chapter_number"
        value={formData.chapter_number || ''}
        onChange={handleChange}
        min="1"
        max="114"
        style={inputStyles}
        placeholder="e.g. 2 (parent chapter only)"
      />
    </div>

    <div>
      <label style={labelStyles}>Page</label>
      <input
        name="page"
        value={formData.page || ''}
        onChange={handleChange}
        style={inputStyles}
        placeholder="Mushaf page (1–604)"
      />
    </div>




    <div>
  <label style={labelStyles}>Sections</label>
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {[1, 2, 3, 4, 5].map((n) => {
      const sel = parseSections(formData.section);
      const selected = sel.includes(n);
      const minSel = sel[0];
      const maxSel = sel[sel.length - 1];

      return (
        <label
          key={n}
          style={{
            padding: '8px 12px',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            cursor: 'pointer',
            userSelect: 'none',
            fontWeight: 600,
            background: selected ? '#2a9d8f' : '#fff',
            color: selected ? '#fff' : '#0f172a',
            borderColor: selected ? '#2a9d8f' : '#cbd5e1',
          }}
        >
          <input
            type="checkbox"
            value={n}
            checked={selected}
            onChange={(e) => {
              setFormData(prev => {
                const current = parseSections(prev.section);

                // CHECKING a box
                if (e.target.checked) {
                  if (current.length === 0) {
                    // single selection can be ANY section
                    return { ...prev, section: String(n) };
                  }
                  // add n and enforce contiguity by filling the gap(s)
                  const min = Math.min(...current, n);
                  const max = Math.max(...current, n);
                  return { ...prev, section: toRangeString(min, max) };
                }

                // UNCHECKING a box
                // If currently single -> go empty
                if (current.length === 1) {
                  return { ...prev, section: '' };
                }

                // For multi-select, only allow removing an EDGE to keep contiguity.
                const min = minSel;
                const max = maxSel;
                if (n === max) {
                  // trim from the right
                  return { ...prev, section: max - 1 >= min ? toRangeString(min, max - 1) : '' };
                }
                if (n === min) {
                  // trim from the left
                  return { ...prev, section: min + 1 <= max ? toRangeString(min + 1, max) : '' };
                }

                // middle uncheck => ignore to keep contiguous selection
                return prev;
              });
            }}
            style={{ display: 'none' }}
          />
          {`Section ${n}`}
        </label>
      );
    })}
  </div>
</div>








  </div>
</div>


        {loadingAuto && <div style={{ marginBottom: 10, color: '#555' }}>Loading verses…</div>}
        {errorText && <div style={{ marginBottom: 10, color: '#b00020' }}>{errorText}</div>}

        {/* Verses */}
        {showVerses && (
          <>
          {pageChapterRange && (
  <div
    style={{
      textAlign: 'center',
      margin: '8px 0 14px',
      padding: '8px 12px',
      background: '#eef2f7',
      borderRadius: 6,
      fontSize: 16,
      color: '#334155',
      fontWeight: 600,
    }}
  >
    Mushaf page {pageChapterRange.page}: Surah {formData.chapter_name || formData.chapter_number} — verses {pageChapterRange.begin} – {pageChapterRange.end}
  </div>
)}

            {verses.map((v, i) => (
              <div key={i} style={{ textAlign: 'center', marginBottom: '12px', fontSize: '22px' }}>
                {v.text} — {v.numberInSurah}
                <div style={{ fontSize: '14px', color: '#555' }}>
                  Letters: <strong>{v.letterCount}</strong> | Mushaf page: <strong>{v.page}</strong>
                </div>
              </div>
            ))}

            {/* <div
              style={{
                textAlign: 'center',
                margin: '10px 0 16px',
                padding: '8px 12px',
                background: '#f1f5f9',
                borderRadius: '6px',
                fontWeight: 'bold',
              }}
            >
              Total letters in range: {totalLetters}
              <br />
              Verse resides in Mushaf page{versePages.length > 1 ? 's' : ''}: {versePages.join(', ')}
            </div> */}

            {pageDetails.totalLettersOnPage > 0 && (
                 <div style={{ marginTop: 8, textAlign: 'left' }}>
               {/* <strong>Total letters in Mushaf page {versePages[0]}:</strong> {pageDetails.totalLettersOnPage} */}
               <br />
                      <br />
                 {/* {pageDetails.sections
                .filter(sec => sec.ayahs.length)         // 🔸 hide empty sections
               .map((sec, idx) => {
                 const first = sec.ayahs[0];
                   const last  = sec.ayahs[sec.ayahs.length - 1];
                  return (
                     <div key={idx} style={{ marginBottom: 6 }}>
                  Section {idx + 1} : Surah {first.surah} : Verse {first.verse} - {last.verse} (Letters: {sec.letters})
                </div>
               );
                })} */}
                 </div>
               )}



                 </>
         )}

        {/* Auto-populated read-only fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
          <div>
            <label style={labelStyles}>Chapter Name</label>
            <input name="chapter_name" value={formData.chapter_name || ''} readOnly style={inputStyles} />
          </div>
          <div>
            <label style={labelStyles}>Verse Range</label>
            <input name="verse" value={formData.verse || ''} readOnly style={inputStyles} />
          </div>
        </div>

        {/* Original counters (restored) */}
        {/* Centered Progress Controls */}
{/* Centered Progress Controls */}
<div style={controlsWrapper}>
  <div style={controlsGroup}>
    {/* Left column: Number of Readings (top) + Complete Memorization (under it) */}
    <div style={stackCol}>
      {/* Number of Readings */}
      <div style={controlCard}>
        <div style={controlTitle}>Number of Readings</div>
        <div style={counterRow}>
          <button
            type="button"
            onClick={() =>
              setFormData(p => ({ ...p, number_of_readings: Math.max(0, (p.number_of_readings || 0) - 1) }))
            }
            style={stepBtn}
          >
            −
          </button>
          <input
            type="number"
            name="number_of_readings"
            min="0"
            value={formData.number_of_readings || 0}
            onChange={handleChange}
            style={counterInput}
          />
          <button
            type="button"
            onClick={() =>
              setFormData(p => ({ ...p, number_of_readings: (p.number_of_readings || 0) + 1 }))
            }
            style={stepBtn}
          >
            +
          </button>
        </div>
      </div>

      {/* Complete Memorization (under Number of Readings) */}
      <div style={controlCard}>
        <div style={controlTitle}>Complete Memorization</div>
        <label style={toggleRow}>
          <input
            type="checkbox"
            name="complete_memorization"
            checked={!!formData.complete_memorization}
            onChange={(e) => setFormData(p => ({ ...p, complete_memorization: e.target.checked }))}
          />
          <span>Mark as Completed</span>
        </label>
      </div>

      <div style={controlCard}>
      <div style={controlTitle}>Murajaah 20 Times</div>
      <div style={counterRow}>
        <button
          type="button"
          onClick={() =>
            setFormData(p => ({ ...p, murajaah_20_times: Math.max(0, (p.murajaah_20_times || 0) - 1) }))
          }
          style={stepBtn}
        >
          −
        </button>
        <input
          type="number"
          name="murajaah_20_times"
          min="0"
          max="20"
          value={formData.murajaah_20_times || 0}
          onChange={(e) => {
            const n = Math.max(0, Math.min(20, Number(e.target.value || 0)));
            setFormData(p => ({ ...p, murajaah_20_times: n }));
          }}
          style={counterInput}
        />
        <button
          type="button"
          onClick={() =>
            setFormData(p => ({ ...p, murajaah_20_times: Math.min(20, (p.murajaah_20_times || 0) + 1) }))
          }
          style={stepBtn}
        >
          +
        </button>
      </div>
    </div>


    </div>

    {/* Right column: Murajaah 20 Times */}
    
  </div>
</div>



        <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
  <div style={actionsRow}>
    <button type="button" onClick={onClose} style={closeButtonStyles}>
      Close
    </button>
    <button type="submit" style={submitButtonStyles} disabled={!userId}>
      Save
    </button>
  </div>
</form>



        
      </div>
    </div>
  );
};

// ---------- styles ----------
const mediaQuery = '@media (max-width: 500px)';

const modalStyles = {
  position: 'fixed',
  top: 0, left: 0, right: 0, bottom: 0,
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  zIndex: 1000,
};

const modalContentStyles = {
  width: '90%',
  maxWidth: '960px',
  maxHeight: '88vh',
  overflowY: 'auto',
  backgroundColor: '#fff',
  padding: '20px',
  borderRadius: '8px',
  boxSizing: 'border-box',
  [mediaQuery]: { width: '92%' },
};

const labelStyles = { fontWeight: 'bold', marginBottom: '6px', display: 'block' };
const inputStyles = { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', width: '100%' };

const incBtn = {
  padding: '8px 12px',
  background: '#84a59d',
  border: 'none',
  color: '#fff',
  borderRadius: 6,
  cursor: 'pointer'
};
const stackCol = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
};

const controlsWrapper = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  marginTop: 16,
};

const controlsGroup = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'stretch',
  gap: 16,
  flexWrap: 'wrap',
  maxWidth: 860,
};

const controlCard = {
  minWidth: 220,
  background: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: 12,
  padding: '14px 16px',
  textAlign: 'center',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const controlTitle = {
  fontWeight: 600,
  marginBottom: 8,
  color: '#0f172a',
};

const counterRow = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
};

const stepBtn = {
  padding: '8px 12px',
  background: '#84a59d',
  border: 'none',
  color: '#fff',
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};

const counterInput = {
  width: 80,
  textAlign: 'center',
  padding: '8px 10px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  margin: 0,
};

const toggleRow = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 10,
  padding: '6px 10px',
  background: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: 8,
  justifyContent: 'center',
};

const inputsContainer = {
  display: 'flex',
  justifyContent: 'center',
  marginBottom: 12,
};

const inputsStack = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  width: '100%',
  maxWidth: 720,      // tweak as you like
};

const actionsRow = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: 12,
  marginTop: 16,     // moved from Close button
};



const closeButtonStyles = {
  /* marginTop: '16px',  <-- delete this line */
  padding: '10px',
  backgroundColor: '#84a59d',
  border: 'none',
  color: 'white',
  borderRadius: '5px',
  cursor: 'pointer',
};


const submitButtonStyles = {
  padding: '10px',
  backgroundColor: '#2a9d8f',
  border: 'none',
  color: 'white',
  borderRadius: '5px',
  cursor: 'pointer',
};

const sectionGroup = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const sectionBox = {
  padding: '8px 12px',
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  cursor: 'pointer',
  userSelect: 'none',
  fontWeight: 600,
  background: '#fff',
  color: '#0f172a',
};
const sectionBoxActive = {
  background: '#2a9d8f',
  color: '#ffffff',
  borderColor: '#2a9d8f',
};



export default SabaqModal;
