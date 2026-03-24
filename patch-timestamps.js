#!/usr/bin/env node
// Patches Claude Code cli.js to add timestamps on tool use headers.
// Usage: node patch-timestamps.js [path-to-cli.js]
//
// Two patches:
//   1. Individual tool headers (Bash, Edit, Write, etc.)
//   2. Collapsed read/search groups (Read, Grep, Glob summary lines)

const fs = require('fs');
const filepath = process.argv[2] || 'cli.js';

if (!fs.existsSync(filepath)) {
  console.error(`Error: ${filepath} not found`);
  process.exit(1);
}

let code = fs.readFileSync(filepath, 'utf8');
let patchCount = 0;

// ─── Patch 1: Individual tool use header ───
// Find: createElement(BOX,{...justifyContent:"space-between",marginTop:VAR,width:"100%"...},INNER)
// Near: resolvedToolUseIDs and renderToolUseTag
// Add a timestamp element as second child of that createElement
{
  // Find all space-between+marginTop+width:100% patterns
  const re = /justifyContent:"space-between",marginTop:(\w+),width:"100%"/g;
  let match;
  while ((match = re.exec(code)) !== null) {
    const before = code.substring(Math.max(0, match.index - 15000), match.index);
    if (!before.includes('resolvedToolUseIDs') || !before.includes('renderToolUseTag')) continue;

    // Find the param variable from resolvedToolUseIDs.has(VAR.id)
    const paramMatch = before.match(/resolvedToolUseIDs\.has\((\w+)\.id\)/);
    if (!paramMatch) continue;
    const paramVar = paramMatch[1];

    // Find React var from createElement call right before
    const nearBefore = code.substring(Math.max(0, match.index - 200), match.index);
    const ceMatch = nearBefore.match(/(\w+)\.default\.createElement\((\w+),\{[^}]*$/);
    if (!ceMatch) continue;
    const reactVar = ceMatch[1];

    // Find Text component
    const textMatch = before.match(/\.createElement\((\w+),\{dimColor:!?[01t]/);
    const textVar = textMatch ? textMatch[1] : 'v';

    // Find the closing of the createElement props + first child: ...width:"100%"...},INNER)
    // Walk forward from match to find },INNER) pattern
    const afterMatch = code.substring(match.index + match[0].length);
    // Skip any remaining props (like backgroundColor:VAR)
    const propsEndMatch = afterMatch.match(/^[^}]*\},(\w+)\)/);
    if (!propsEndMatch) continue;

    const innerVar = propsEndMatch[1];
    const insertPos = match.index + match[0].length + propsEndMatch.index + propsEndMatch[0].length - 1; // before the )

    const tsCode = `,(function(){if(!globalThis.__toolTs)globalThis.__toolTs={};if(!globalThis.__toolTs[${paramVar}.id])globalThis.__toolTs[${paramVar}.id]=new Date().toLocaleTimeString("en-GB",{hour12:false});return ${reactVar}.default.createElement(${textVar},{dimColor:true},globalThis.__toolTs[${paramVar}.id])})()`;

    code = code.slice(0, insertPos) + tsCode + code.slice(insertPos);
    patchCount++;
    console.log(`Patch 1 applied: individual tool header (param=${paramVar}, react=${reactVar}, text=${textVar})`);
    break;
  }
  if (patchCount === 0) console.warn('Patch 1: pattern not found');
}

// ─── Patch 2: Collapsed read/search component ───
// Find by: TeamMemCountParts({message:VAR,isActiveGroup:
// The row containing this is a createElement(BOX,{flexDirection:"row"},...)
// We add space-between+width:100% and wrap + add timestamp
{
  const marker = 'TeamMemCountParts({message:';
  const markerIdx = code.indexOf(marker);

  if (markerIdx !== -1) {
    const msgVarMatch = code.substring(markerIdx, markerIdx + 80).match(/TeamMemCountParts\(\{message:(\w+),isActiveGroup:(\w+)/);

    if (msgVarMatch) {
      const msgVar = msgVarMatch[1];
      const activeVar = msgVarMatch[2];

      // Find the React var and Box var from nearby createElement calls
      const searchBefore = code.substring(Math.max(0, markerIdx - 2000), markerIdx);
      const reactMatch = searchBefore.match(/(\w+)\.default\.createElement\((\w+),\{flexDirection:"row"\}/);

      if (reactMatch) {
        const reactVar = reactMatch[1];
        const boxVar = reactMatch[2];

        // Find the Text var
        const textMatch = searchBefore.match(/\.createElement\((\w+),\{dimColor:/);
        const textVar = textMatch ? textMatch[1] : 'T';

        // Find the start of the row createElement(BOX,{flexDirection:"row"},
        const rowStartStr = `${reactVar}.default.createElement(${boxVar},{flexDirection:"row"},`;
        const rowSearchRegion = code.substring(Math.max(0, markerIdx - 1500), markerIdx);
        const rowStartInRegion = rowSearchRegion.lastIndexOf(rowStartStr);

        if (rowStartInRegion !== -1) {
          const rowStartPos = Math.max(0, markerIdx - 1500) + rowStartInRegion;

          // Find the end of this row: match parentheses from the createElement call
          const rowContent = code.substring(rowStartPos);
          const rowEndPos = rowStartPos + findMatchingParen(rowContent, rowContent.indexOf('('));

          if (rowEndPos > rowStartPos) {
            const originalRow = code.substring(rowStartPos, rowEndPos + 1);
            const innerContent = originalRow.substring(rowStartStr.length, originalRow.length - 1);

            const tsIIFE = `(function(){if(!globalThis.__toolTs)globalThis.__toolTs={};var tid=${msgVar}.uuid||"crs";if(!globalThis.__toolTs[tid]){var ts=${msgVar}.timestamp?new Date(${msgVar}.timestamp):new Date();globalThis.__toolTs[tid]=ts.toLocaleTimeString("en-GB",{hour12:false})}return ${reactVar}.default.createElement(${textVar},{dimColor:true},globalThis.__toolTs[tid])})()`;

            const newRow = `${reactVar}.default.createElement(${boxVar},{flexDirection:"row",justifyContent:"space-between",width:"100%"},${reactVar}.default.createElement(${boxVar},{flexDirection:"row"},${innerContent}),${tsIIFE})`;

            code = code.substring(0, rowStartPos) + newRow + code.substring(rowEndPos + 1);
            patchCount++;
            console.log(`Patch 2a applied: collapsed row (react=${reactVar}, msg=${msgVar})`);

            // Patch 2b: add width:"100%" to the outer column (search backwards from row)
            const outerSearch = code.substring(Math.max(0, rowStartPos - 500), rowStartPos);
            const colMatch = outerSearch.match(/\.createElement\(\w+,\{flexDirection:"column",marginTop:1([^}]*)\}/);
            if (colMatch && !colMatch[0].includes('width:"100%"')) {
              const colPos = Math.max(0, rowStartPos - 500) + outerSearch.indexOf(colMatch[0]);
              const oldCol = colMatch[0];
              const newCol = oldCol.replace(/\}$/, ',width:"100%"}');
              code = code.substring(0, colPos) + newCol + code.substring(colPos + oldCol.length);
              patchCount++;
              console.log('Patch 2b applied: outer column width:100%');
            }
          }
        } else {
          console.warn('Patch 2: could not find row start');
        }
      } else {
        console.warn('Patch 2: could not find React var');
      }
    }
  } else {
    console.warn('Patch 2: TeamMemCountParts not found');
  }
}

// ─── Write result ───
if (patchCount > 0) {
  fs.writeFileSync(filepath, code);
  console.log(`\nDone: ${patchCount} patch(es) applied to ${filepath}`);

  const { execSync } = require('child_process');
  try {
    execSync(`"${process.execPath}" --check "${filepath}"`, { stdio: 'pipe' });
    console.log('Syntax check: OK');
  } catch (e) {
    console.error('WARNING: Syntax check failed!');
    console.error(e.stderr?.toString());
    process.exit(1);
  }
} else {
  console.error('\nNo patches applied. The code structure may have changed.');
  process.exit(1);
}

// ─── Helpers ───
function findMatchingParen(str, startIdx) {
  let depth = 0;
  let inStr = false;
  let strChar = '';
  for (let i = startIdx; i < str.length; i++) {
    const ch = str[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === strChar) inStr = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; strChar = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
