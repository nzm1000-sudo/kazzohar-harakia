import test from 'node:test';
import assert from 'node:assert';
import { shabbatTableContent, shabbatTableParashaCount } from '../src/services/shabbatTable.mjs';

// REGRESSION TEST: Task G - Shabbat Table Expansion
// Verify 3-5 divreiTorah, childContent, familyQuestion, practicalPoint per parsha
// Verify offline packaging and zero network dependency

test('Task G: Shabbat table has all 54+ parshiyot configured', () => {
  assert.ok(shabbatTableParashaCount >= 54, 
    `Expected at least 54 parshiyot, got ${shabbatTableParashaCount}`);
});

test('Task G: ALL 54+ parshiyot have complete structure with childContent and practicalPoint', () => {
  // This is the CORE requirement: every single parsha must have these fields populated
  const count = shabbatTableParashaCount;
  let completeCount = 0;
  let missingChildContent = [];
  let missingPracticalPoint = [];
  
  // Get all parsha names from the internal data
  const PARASHOT_NAMES = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
    'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה',
    'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים',
    'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק',
    'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];
  
  for (const parsha of PARASHOT_NAMES.slice(0, count)) {
    const content = shabbatTableContent(parsha);
    
    assert.ok(content, `${parsha} should have content`);
    assert.ok(content.summary, `${parsha} must have summary`);
    assert.ok(content.familyQuestion, `${parsha} must have familyQuestion`);
    assert.ok(content.childQuestion, `${parsha} must have childQuestion`);
    assert.ok(content.offline === true, `${parsha} must be marked offline`);
    
    // REQUIRED: childContent must exist and be non-empty
    assert.ok(content.childContent && content.childContent.length > 0, 
      `${parsha} MUST have non-empty childContent (required for task)`);
    
    // REQUIRED: practicalPoint must exist and be non-empty
    assert.ok(content.practicalPoint && content.practicalPoint.length > 0, 
      `${parsha} MUST have non-empty practicalPoint (required for task)`);
    
    if (content.childContent && content.childContent.length > 0 && 
        content.practicalPoint && content.practicalPoint.length > 0) {
      completeCount++;
    }
  }
  
  assert.equal(completeCount, count, 
    `ALL ${count} parshiyot must have both childContent and practicalPoint. Got ${completeCount}/${count}`);
});

test('Task G: ALL parshiyot have at least 3 real divreiTorah with proper structure', () => {
  // This is a CORE requirement: every parsha needs 3-5 divreiTorah
  const count = shabbatTableParashaCount;
  let validCount = 0;
  let invalidParshiyot = [];
  
  const PARASHOT_NAMES = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
    'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה',
    'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים',
    'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק',
    'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];
  
  for (const parsha of PARASHOT_NAMES.slice(0, count)) {
    const content = shabbatTableContent(parsha);
    
    assert.ok(Array.isArray(content.divreiTorah), `${parsha} divreiTorah must be array`);
    
    // REQUIRED: minimum 3 divreiTorah
    if (content.divreiTorah.length < 3) {
      invalidParshiyot.push(`${parsha} (has ${content.divreiTorah.length})`);
    } else if (content.divreiTorah.length > 5) {
      invalidParshiyot.push(`${parsha} (has ${content.divreiTorah.length}, max 5)`);
    } else {
      // Verify each divrei Torah has required fields
      for (const dvar of content.divreiTorah) {
        assert.ok(dvar.title && dvar.title.length > 0, `${parsha} divrei Torah must have title`);
        assert.ok(dvar.text && dvar.text.length > 0, `${parsha} divrei Torah must have text`);
        assert.ok(dvar.type, `${parsha} divrei Torah must have type`);
      }
      validCount++;
    }
  }
  
  assert.equal(validCount, count, 
    `ALL ${count} parshiyot must have 3-5 divreiTorah. Problems: ${invalidParshiyot.join('; ')}`);
});

test('Task G: Each divrei Torah has required fields with meaningful content', () => {
  const PARASHOT_NAMES = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
    'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה',
    'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים',
    'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק',
    'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];
  
  const validTypes = ['קצר', 'משפחה', 'ילדים', 'עומק', 'מוסר'];
  let issues = [];
  
  for (const parsha of PARASHOT_NAMES.slice(0, shabbatTableParashaCount)) {
    const content = shabbatTableContent(parsha);
    
    for (let i = 0; i < content.divreiTorah.length; i++) {
      const dvar = content.divreiTorah[i];
      if (!dvar.title || !dvar.text || !dvar.type) {
        issues.push(`${parsha} divrei Torah #${i+1}: missing required field`);
      }
      if (dvar.type && !validTypes.includes(dvar.type)) {
        issues.push(`${parsha} divrei Torah #${i+1}: invalid type "${dvar.type}"`);
      }
    }
  }
  
  assert.equal(issues.length, 0, 
    `divreiTorah field issues: ${issues.slice(0, 20).join('; ')}`);
});

test('Task G: All parshiyot return content with offline flag and source metadata', () => {
  const count = shabbatTableParashaCount;
  const PARASHOT_NAMES = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
    'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה',
    'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים',
    'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק',
    'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];
  
  for (const parsha of PARASHOT_NAMES.slice(0, count)) {
    const content = shabbatTableContent(parsha);
    assert.ok(content, `${parsha} should have content`);
    assert.strictEqual(content.offline, true, `${parsha} must have offline=true`);
    assert.ok(content.source, `${parsha} must have source metadata`);
    assert.ok(content.source.ref, `${parsha} source must have reference`);
    assert.ok(content.quiz, `${parsha} must have quiz`);
  }
});

test('Task G: No network calls required - all content is fully local', () => {
  const count = shabbatTableParashaCount;
  const PARASHOT_NAMES = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
    'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה',
    'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים',
    'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק',
    'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];
  
  // Verify all returned data is local strings, not promises or network references
  for (const parsha of PARASHOT_NAMES.slice(0, count)) {
    const content = shabbatTableContent(parsha);
    
    const checkLocal = (obj) => {
      if (typeof obj === 'string') return true;
      if (typeof obj === 'boolean' || typeof obj === 'number') return true;
      if (obj === null) return true;
      if (obj instanceof Promise) return false;
      if (typeof obj === 'object') {
        if (typeof obj.then === 'function') return false;
        for (const key in obj) {
          if (!checkLocal(obj[key])) return false;
        }
        return true;
      }
      return true;
    };
    
    assert.ok(checkLocal(content), `${parsha} content must be fully local (no promises/network refs)`);
  }
});

test('Task G: Content quality - all fields are meaningful and family-appropriate', () => {
  const count = shabbatTableParashaCount;
  const PARASHOT_NAMES = [
    'בראשית', 'נח', 'לך לך', 'וירא', 'חיי שרה', 'תולדות', 'ויצא', 'וישלח', 'וישב', 'מקץ',
    'ויגש', 'ויחי', 'שמות', 'וארא', 'בא', 'בשלח', 'יתרו', 'משפטים', 'תרומה', 'תצוה',
    'כי תשא', 'ויקהל', 'פקודי', 'ויקרא', 'צו', 'שמיני', 'תזריע', 'מצורע', 'אחרי מות', 'קדושים',
    'אמור', 'בהר', 'בחוקותי', 'במדבר', 'נשא', 'בהעלותך', 'שלח', 'קרח', 'חקת', 'בלק',
    'פינחס', 'מטות', 'מסעי', 'דברים', 'ואתחנן', 'עקב', 'ראה', 'שופטים', 'כי תצא', 'כי תבוא',
    'נצבים', 'וילך', 'האזינו', 'וזאת הברכה'
  ];
  
  let qualityIssues = [];
  
  for (const parsha of PARASHOT_NAMES.slice(0, count)) {
    const content = shabbatTableContent(parsha);
    
    // Check childContent quality
    if (!content.childContent || content.childContent.length < 10) {
      qualityIssues.push(`${parsha}: childContent too short`);
    }
    
    // Check practicalPoint quality
    if (!content.practicalPoint || content.practicalPoint.length < 5) {
      qualityIssues.push(`${parsha}: practicalPoint too short`);
    }
    
    // Verify divreiTorah have meaningful content
    for (let i = 0; i < content.divreiTorah.length; i++) {
      const dvar = content.divreiTorah[i];
      if (!dvar.title || dvar.title.length < 3) {
        qualityIssues.push(`${parsha}: divrei Torah #${i+1} has weak title`);
      }
      if (!dvar.text || dvar.text.length < 10) {
        qualityIssues.push(`${parsha}: divrei Torah #${i+1} has weak text`);
      }
    }
  }
  
  assert.equal(qualityIssues.length, 0, 
    `Content quality issues found: ${qualityIssues.slice(0, 20).join('; ')}`);
});
