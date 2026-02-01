# Arcane Explosion Bug Fix

## Problem

Arcane Explosion was only hitting its primary target (enemy with most buffs) but not hitting adjacent enemies.

## Root Cause

The bug was in how `perTargetExtras` were mapped to resolved targets in [spell.js](src/spell.js).

**The Issue:**
- `perTargetExtras` is an array that maps 1:1 with **target descriptors** in the spell spec
- But when a descriptor resolves to **multiple targets** (like `adjacent` which can resolve to 2-3 tiles), the simple index-based mapping broke

**Example for Arcane Explosion:**

Spell definition:
```javascript
targets: [
  { type: 'mostBuffs', side: 'enemy', max: 1 },  // Descriptor 0
  { type: 'adjacent', side: 'enemy' }             // Descriptor 1
],
perTargetExtras: [
  { post: { removeTopPositiveEffect: true } },    // For descriptor 0
  {}                                              // For descriptor 1
]
```

After target resolution:
- `targets[0]` = mostBuffs target (1 target from descriptor 0)
- `targets[1]` = first adjacent target (from descriptor 1)
- `targets[2]` = second adjacent target (from descriptor 1)
- `targets[3]` = third adjacent target (from descriptor 1)

**Before the fix:**
- `perTargetExtras[0]` was applied to `targets[0]` ✓ (correct)
- `perTargetExtras[1]` was applied to `targets[1]` ✓ (correct)
- `perTargetExtras[2]` was applied to `targets[2]` ✗ (doesn't exist - undefined!)
- `perTargetExtras[3]` was applied to `targets[3]` ✗ (doesn't exist - undefined!)

The old code used `perTargetExtras[i]` where `i` was the target index, not the descriptor index.

## Solution

Modified [spell.js](src/spell.js) to:

1. **Track descriptor indices**: Created `descriptorIndexForTarget[]` array that maps each resolved target back to its source descriptor
2. **Resolve targets progressively**: Resolve descriptors cumulatively so `adjacent` type can find the anchor from previous descriptors
3. **Use descriptor index for perTargetExtras**: When merging perTargetExtras, use `descriptorIndexForTarget[i]` instead of just `i`

**After the fix:**
- `targets[0]` from descriptor 0 → gets `perTargetExtras[0]` ✓
- `targets[1]` from descriptor 1 → gets `perTargetExtras[1]` ✓
- `targets[2]` from descriptor 1 → gets `perTargetExtras[1]` ✓
- `targets[3]` from descriptor 1 → gets `perTargetExtras[1]` ✓

All adjacent targets now correctly get their descriptor's extras (which is empty `{}` for them), and only the primary target gets `removeTopPositiveEffect`.

## Testing

Created [test-arcane-explosion.js](test-arcane-explosion.js) which verifies:
- Primary target (mostBuffs) has `removeTopPositiveEffect` 
- Adjacent targets have damage but NOT `removeTopPositiveEffect`
- All expected targets are hit (1 primary + N adjacent)

Both the new test and existing smoke tests pass.

## Impact

This fix resolves the issue for **any spell** that uses `perTargetExtras` with multi-target descriptors, not just Arcane Explosion. Any spell that combines different targeting types with per-descriptor customization will now work correctly.
