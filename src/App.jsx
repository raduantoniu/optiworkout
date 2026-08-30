import React, { useState, useEffect, useMemo } from 'react';
import { ArrowRight, ArrowLeft, Check, Copy, X, AlertTriangle, BookOpen, Loader2 } from 'lucide-react';

// =====================================================
// OPTIWORKOUT — v1
//
// Fourth app in the ShredSmart suite. Consumes a PhysiquePlan SS1 code for
// continuity, then resolves one of eight skeleton splits against the client's
// equipment, lets them veto exercises they can't or won't do, and emits an OP
// code that IS the program.
//
// ARCHITECTURE
//   A skeleton is an ordered list of MOVEMENT PATTERN slots — never exercises.
//   Each pattern has a POOL: exercises in preference order, each tagged with
//   the equipment it requires. The resolver walks the pool and takes the first
//   the client can equip and hasn't vetoed. Rep ranges are DERIVED by the
//   engine from the pattern's base range plus the resolved exercise's flags —
//   never hand-authored, never stored in the code.
// =====================================================

// =====================================================
// EQUIPMENT VOCABULARY
// =====================================================
const EQ = {
  BARBELL:'barbell', DUMBBELLS:'dumbbells', EZ_BAR:'ez bar', TRAP_BAR:'trap bar',
  RACK:'adjustable rack', FLAT_BENCH:'flat bench station', ADJ_BENCH:'adjustable bench',
  INCLINE_STATION:'incline bench station',
  CABLE:'cable station', LAT_PULLDOWN:'lat pulldown (cable)',
  PULLUP_BAR:'pull-up bar', NEUTRAL_BARS:'neutral grip bars', WEIGHT_BELT:'weight belt',
  SMITH:'smith machine', LEVER_ARMS:'lever arms', LANDMINE:'landmine', BANDS:'resistance bands',
  HACK:'hack squat machine', PENDULUM:'pendulum squat machine', LEG_PRESS_M:'leg press machine',
  LEG_EXT_M:'leg extension machine', LEG_CURL_SEATED_M:'seated leg curl machine',
  LEG_CURL_LYING_M:'lying leg curl machine',
  LEG_CURL_KNEELING_M:'kneeling leg curl machine',
  CALF_STANDING_M:'standing calf raise machine', CALF_SEATED_M:'seated calf raise machine',
  CALF_SEATED_STRAIGHT_M:'seated straight-leg calf raise machine',
  STEPPER:'step / platform',
  CHEST_PRESS_M:'chest press machine', INCLINE_PRESS_M:'incline chest press machine',
  PEC_DECK:'pec deck', CHEST_FLY_M:'chest fly machine',
  SHOULDER_PRESS_M:'shoulder press machine', VIKING:'viking press',
  LAT_RAISE_M:'lateral raise machine', REAR_DELT_M:'rear delt fly machine',
  ROW_CS_M:'chest supported row machine', TBAR_M:'t-bar row machine',
  SEAL_BENCH:'seal row bench', PULLDOWN_M:'lat pulldown machine',
  SHRUG_M:'shrug machine', HIP_THRUST_M:'hip thrust machine', HIP_THRUST_STATION:'hip thrust station',
  ROMAN_CHAIR:'roman chair', CRUNCH_M:'abs crunch machine', CAPTAINS_CHAIR:"captain's chair",
  HEAD_HARNESS:'head harness', PLATE:'barbell plates',
};

// =====================================================
// EXERCISE LIBRARY
// id: [display name, [equipment...], {flags}]
// flags — db: dumbbell (widens range to span 4), sa: single-arm (+2 on
// compounds only), amrap: no prescribed range
// =====================================================
const EXERCISES = {
  // SQUAT
  HACK_SQUAT:['Hack Squat',[EQ.HACK],{primary:true}],
  PENDULUM_SQUAT:['Pendulum Squat',[EQ.PENDULUM],{primary:true}],
  LEG_PRESS:['Leg Press',[EQ.LEG_PRESS_M],{primary:true}],
  SQUAT_SMITH:['Smith Machine Squat',[EQ.SMITH],{primary:true}],
  SQUAT_BACK:['Back Squat',[EQ.BARBELL,EQ.RACK],{primary:true}],
  SQUAT_FRONT:['Front Squat',[EQ.BARBELL,EQ.RACK],{primary:true}],
  SPLIT_SQUAT_BULG:['Bulgarian Split Squat',[EQ.DUMBBELLS],{primary:true,db:true}],
  // HINGE
  RDL_LEVER:['Romanian Deadlift (Lever Arms)',[EQ.LEVER_ARMS],{primary:true}],
  RDL_TRAP:['Romanian Deadlift (Trap Bar)',[EQ.TRAP_BAR],{primary:true}],
  BACK_EXT_WTD:['Weighted Back Extension',[EQ.ROMAN_CHAIR,EQ.PLATE]],
  RDL_LANDMINE:['Romanian Deadlift (Landmine)',[EQ.LANDMINE,EQ.BARBELL],{primary:true}],
  RDL_SMITH:['Romanian Deadlift (Smith)',[EQ.SMITH],{primary:true}],
  RDL_BB:['Romanian Deadlift (Barbell)',[EQ.BARBELL],{primary:true}],
  RDL_CABLE:['Romanian Deadlift (Cable)',[EQ.CABLE],{primary:true}],
  RDL_DB:['Romanian Deadlift (Dumbbell)',[EQ.DUMBBELLS],{primary:true,db:true}],
  // GLUTE
  HIP_THRUST_BB:['Barbell Hip Thrust (Hip Thrust Station)',[EQ.HIP_THRUST_STATION,EQ.BARBELL]],
  HIP_THRUST_MACH:['Hip Thrust (Machine)',[EQ.HIP_THRUST_M]],
  HIP_THRUST_SMITH:['Hip Thrust (Smith Machine)',[EQ.SMITH,EQ.FLAT_BENCH]],
  HIP_THRUST_BENCH:['Barbell Hip Thrust (Bench Propped, Manual Setup)',[EQ.BARBELL,EQ.FLAT_BENCH]],
  HIP_THRUST_DB_1L:['Single-Leg Hip Thrust (Dumbbell)',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{db:true,sa:true}],
  // LEG_EXT
  LEG_EXT:['Leg Extension',[EQ.LEG_EXT_M]],
  REVERSE_NORDIC:['Band-Assisted Reverse Nordic Curl',[EQ.BANDS],{lastResort:true}],
  SISSY_SQUAT:['Sissy Squat',[]],
  // LEG_CURL
  LEG_CURL_SEATED:['Seated Leg Curl',[EQ.LEG_CURL_SEATED_M]],
  LEG_CURL_LYING:['Lying Leg Curl',[EQ.LEG_CURL_LYING_M]],
  LEG_CURL_KNEELING:['Kneeling Leg Curl (Machine)',[EQ.LEG_CURL_KNEELING_M]],
  NORDIC_BAND:['Band-Assisted Nordic Curl',[EQ.BANDS],{lastResort:true}],
  // CALF
  CALF_STRAIGHT_M:['Seated Straight-Leg Calf Raise (Machine)',[EQ.CALF_SEATED_STRAIGHT_M]],
  CALF_STANDING_MACH:['Standing Calf Raise (Machine)',[EQ.CALF_STANDING_M]],
  CALF_STANDING_CABLE:['Standing Calf Raise (Cable)',[EQ.CABLE,EQ.STEPPER]],
  CALF_STRAIGHT_SM:['Straight Leg Calf Raise (Smith)',[EQ.SMITH,EQ.STEPPER]],
  CALF_STRAIGHT_DB:['Straight Leg Calf Raise (DB)',[EQ.DUMBBELLS,EQ.STEPPER],{db:true}],
  CALF_SEATED:['Seated Calf Raise',[EQ.CALF_SEATED_M]],
  CALF_SL_BW:['Single-Leg Calf Raise (Bodyweight)',[],{sa:true}],
  // INCLINE_PRESS
  INC_BB_30:['30° Incline Barbell Press',[EQ.BARBELL,EQ.INCLINE_STATION],{primary:true}],
  INC_BB_15:['15° Incline Barbell Press',[EQ.BARBELL,EQ.RACK,EQ.ADJ_BENCH],{primary:true}],
  INC_DB_30:['30° Incline Dumbbell Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{primary:true,db:true}],
  INC_DB_15:['15° Incline Dumbbell Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{primary:true,db:true}],
  INC_PRESS_MACH:['Incline Chest Press (Plate-Loaded)',[EQ.INCLINE_PRESS_M]],
  INC_PRESS_MACH_STACK:['Incline Chest Press (Stack-Loaded)',[EQ.INCLINE_PRESS_M]],
  INC_PRESS_SMITH:['Smith Machine Incline Bench Press',[EQ.SMITH,EQ.ADJ_BENCH]],
  // FLAT_PRESS
  BENCH_BB:['Barbell Bench Press',[EQ.BARBELL,EQ.RACK,EQ.FLAT_BENCH],{primary:true}],
  CHEST_PRESS_MACH:['Vertical Chest Press (Machine)',[EQ.CHEST_PRESS_M]],
  CHEST_PRESS_FLAT_MACH:['Flat Chest Press (Machine)',[EQ.CHEST_PRESS_M]],
  CHEST_PRESS_NEUTRAL_MACH:['Chest Press (Machine, Neutral Grip)',[EQ.CHEST_PRESS_M]],
  BENCH_SMITH:['Flat Bench Press (Smith Machine)',[EQ.SMITH,EQ.FLAT_BENCH]],
  BENCH_DB_FLAT:['Flat Dumbbell Bench Press',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{primary:true,db:true}],
  // CHEST_ISO
  DB_FLY_PRESS:['DB Fly-Press',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{db:true}],
  DB_FLY_PRESS_INC:['Incline DB Fly-Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  PEC_DECK:['Pec Deck',[EQ.PEC_DECK]],
  CHEST_FLY_MACH:['Chest Fly (Plate-Loaded)',[EQ.CHEST_FLY_M]],
  CHEST_FLY_MACH_STACK:['Chest Fly (Stack-Loaded)',[EQ.CHEST_FLY_M]],
  CHEST_FLY_CABLE:['Seated Cable Fly',[EQ.CABLE,EQ.ADJ_BENCH]],
  CHEST_FLY_CABLE_STAND:['Standing Cable Fly',[EQ.CABLE]],
  // VERT_PUSH
  SHLDR_PRESS_DB:['Seated DB Shoulder Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{primary:true,db:true}],
  VIKING_PRESS:['Viking Shoulder Press',[EQ.VIKING],{primary:true}],
  SHLDR_PRESS_MACH:['Shoulder Press (Plate-Loaded)',[EQ.SHOULDER_PRESS_M]],
  SHLDR_PRESS_MACH_STACK:['Shoulder Press (Stack-Loaded)',[EQ.SHOULDER_PRESS_M]],
  OHP_BB:['Standing Overhead Press',[EQ.BARBELL,EQ.RACK],{primary:true}],
  SHLDR_PRESS_SMITH:['Seated Shoulder Press (Smith)',[EQ.SMITH,EQ.ADJ_BENCH]],
  SHLDR_PRESS_DB_1A:['Standing One-Arm DB Press',[EQ.DUMBBELLS],{db:true,sa:true}],
  // HORIZ_PULL
  ROW_TBAR_CS:['Chest-Supported T-Bar Row',[EQ.TBAR_M]],
  ROW_CS_MACH:['Chest-Supported Row (Plate-Loaded)',[EQ.ROW_CS_M]],
  ROW_CS_MACH_STACK:['Chest-Supported Row (Stack-Loaded)',[EQ.ROW_CS_M]],
  ROW_SEAL:['Seal Row (Barbell)',[EQ.SEAL_BENCH,EQ.BARBELL],{primary:true}],
  ROW_CABLE_SEATED:['Seated Cable Row',[EQ.CABLE]],
  ROW_CABLE_CS_1A:['Single-Arm Chest-Supported Cable Row',[EQ.CABLE,EQ.ADJ_BENCH],{sa:true}],
  ROW_CABLE_CS:['Chest-Supported Row (Cable)',[EQ.CABLE,EQ.ADJ_BENCH]],
  ROW_PENDLAY:['Pendlay Row',[EQ.BARBELL],{primary:true}],
  ROW_DB_CS:['Chest-Supported Dumbbell Row',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  ROW_DB_1A:['Single-Arm Dumbbell Row',[EQ.DUMBBELLS],{db:true,sa:true}],
  ROW_INVERTED:['Feet-Elevated Inverted Row',[EQ.BARBELL,EQ.RACK],{amrap:true}],
  // VERT_PULL
  PULLUP_NEUTRAL_W:['Weighted Neutral-Grip Pull-up',[EQ.NEUTRAL_BARS,EQ.WEIGHT_BELT],{primary:true}],
  CHINUP_W:['Weighted Chin-up',[EQ.PULLUP_BAR,EQ.WEIGHT_BELT],{primary:true}],
  PULLUP_W:['Weighted Pull-up',[EQ.PULLUP_BAR,EQ.WEIGHT_BELT],{primary:true}],
  PULLDOWN_CABLE:['Lat Pulldown (Cable)',[EQ.LAT_PULLDOWN]],
  PULLDOWN_CABLE_1A:['Single-Arm Lat Pulldown (Cable)',[EQ.LAT_PULLDOWN],{sa:true}],
  PULLDOWN_MACH:['Lat Pulldown (Plate-Loaded)',[EQ.PULLDOWN_M]],
  PULLDOWN_MACH_STACK:['Lat Pulldown (Stack-Loaded)',[EQ.PULLDOWN_M]],
  PULLDOWN_MACH_1A:['Single-Arm Lat Pulldown (Machine)',[EQ.PULLDOWN_M],{sa:true}],
  PULLUP_BAND:['Band-Assisted Pull-up',[EQ.PULLUP_BAR]],
  PULLOVER_DB:['Dumbbell Pullover',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{db:true}],
  // TRAPS
  SHRUG_MACH:['Shrug (Machine)',[EQ.SHRUG_M]],
  SHRUG_SMITH:['Shrug (Smith Machine)',[EQ.SMITH]],
  SHRUG_TRAP:['Shrug (Trap Bar)',[EQ.TRAP_BAR]],
  SHRUG_BB:['Behind-the-Back Barbell Shrug',[EQ.BARBELL,EQ.RACK]],
  SHRUG_DB:['Shrug (Dumbbell)',[EQ.DUMBBELLS],{db:true}],
  SHRUG_KELSO:['Kelso Shrug (Machine)',[EQ.ROW_CS_M]],
  // SIDE_DELT
  LAT_RAISE_MACH:['Lateral Raise (Machine)',[EQ.LAT_RAISE_M]],
  CUBAN_PRESS:['Cuban Press',[EQ.DUMBBELLS],{db:true}],
  LAT_RAISE_DB:['Lateral Raise (Dumbbell)',[EQ.DUMBBELLS],{db:true}],
  LAT_RAISE_CBL_BTB:['Behind-the-Back Cable Lateral Raise',[EQ.CABLE]],
  LAT_RAISE_CABLE:['Cable Lateral Raise',[EQ.CABLE]],
  // REAR_DELT
  REAR_DELT_MACH:['Rear Delt Fly (Machine)',[EQ.REAR_DELT_M]],
  REAR_DELT_CBL_1A:['Single-Arm Rear Delt Fly (Cable)',[EQ.CABLE],{sa:true}],
  FACE_PULL_CABLE:['Face Pull (Cable)',[EQ.CABLE]],
  REAR_DELT_DB_30:['30° Lying DB Raise',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  // TRI_OH
  TRI_OH_CABLE:['Overhead Tricep Extension (Cable)',[EQ.CABLE]],
  TRI_OH_CABLE_1A:['Single-Arm Overhead Tricep Ext (Cable)',[EQ.CABLE],{sa:true}],
  SKULLCRUSHER_BB:['Skullcrushers (Barbell)',[EQ.BARBELL,EQ.FLAT_BENCH]],
  TRI_OH_DB:['Overhead Tricep Extension (DB)',[EQ.DUMBBELLS],{db:true}],
  TRI_OH_DB_INC:['Incline DB Tricep Extension',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  // TRI_PUSHDOWN
  TRI_PUSHDOWN:['Tricep Pushdown (Cable)',[EQ.CABLE]],
  TRI_PUSHDOWN_1A:['Single-Arm Tricep Pushdown (Cable)',[EQ.CABLE],{sa:true}],
  // BICEPS
  CURL_INCLINE_DB:['Alternating Incline DB Curl',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  CURL_BAYESIAN:['Bayesian Curl (Cable)',[EQ.CABLE]],
  CURL_EZ:['Standing EZ Bar Curl',[EQ.EZ_BAR]],
  CURL_BB:['Barbell Curl',[EQ.BARBELL]],
  CURL_DB_STANDING:['Standing DB Curl',[EQ.DUMBBELLS],{db:true}],
  // ABS
  CRUNCH_MACH:['Abs Crunch (Machine)',[EQ.CRUNCH_M]],
  CRUNCH_CABLE:['Cable Crunch',[EQ.CABLE]],
  LEG_RAISE_LYING:['Lying Leg Raise',[EQ.FLAT_BENCH],{amrap:true}],
  LEG_RAISE_CHAIR:["Captain's Chair Leg Raise",[EQ.CAPTAINS_CHAIR],{amrap:true}],
  DRAGON_FLAG_ECC:['Eccentric Dragon Flag',[EQ.FLAT_BENCH],{amrap:true}],
  // NECK
  NECK_CURL_CABLE:['Standing Neck Curl (Cable)',[EQ.HEAD_HARNESS,EQ.CABLE]],
  NECK_EXT_PLATE_ST:['Standing Neck Extension (Cable)',[EQ.HEAD_HARNESS,EQ.CABLE]],
  NECK_CURL_SEATED_CABLE:['Seated Neck Curl (Cable)',[EQ.HEAD_HARNESS,EQ.CABLE]],
  NECK_EXT_SEATED_CABLE:['Seated Neck Extension (Cable)',[EQ.HEAD_HARNESS,EQ.CABLE]],
  NECK_CURL_PLATE:['Lying Neck Curl (Plate)',[EQ.FLAT_BENCH,EQ.PLATE]],
  NECK_EXT_PLATE:['Lying Neck Extension (Plate)',[EQ.FLAT_BENCH,EQ.PLATE]],
  NECK_CURL_INCLINE:['Incline Neck Curl (Plate)',[EQ.ADJ_BENCH,EQ.HEAD_HARNESS]],
  NECK_EXT_INCLINE:['Incline Neck Extension (Plate)',[EQ.ADJ_BENCH,EQ.HEAD_HARNESS]],
};

// Pools in PREFERENCE ORDER — first equippable, un-vetoed entry wins.
const POOLS = {
  SQUAT:['HACK_SQUAT','PENDULUM_SQUAT','LEG_PRESS','SQUAT_SMITH','SQUAT_BACK','SQUAT_FRONT','SPLIT_SQUAT_BULG'],
  HINGE:['RDL_LEVER','RDL_TRAP','RDL_LANDMINE','RDL_SMITH','RDL_BB','BACK_EXT_WTD','RDL_CABLE','RDL_DB'],
  GLUTE:['HIP_THRUST_BB','HIP_THRUST_MACH','HIP_THRUST_SMITH','HIP_THRUST_BENCH','HIP_THRUST_DB_1L'],
  LEG_EXT:['LEG_EXT','SISSY_SQUAT','REVERSE_NORDIC'],
  LEG_CURL:['LEG_CURL_SEATED','LEG_CURL_LYING','LEG_CURL_KNEELING','NORDIC_BAND'],
  CALF:['CALF_STRAIGHT_M','CALF_STANDING_MACH','CALF_STRAIGHT_SM','CALF_STANDING_CABLE','CALF_STRAIGHT_DB','CALF_SEATED','CALF_SL_BW'],
  INCLINE_PRESS:['INC_BB_30','INC_BB_15','INC_DB_30','INC_DB_15','INC_PRESS_MACH','INC_PRESS_MACH_STACK','INC_PRESS_SMITH'],
  FLAT_PRESS:['BENCH_BB','CHEST_PRESS_MACH','CHEST_PRESS_FLAT_MACH','CHEST_PRESS_NEUTRAL_MACH','BENCH_SMITH','BENCH_DB_FLAT'],
  CHEST_ISO:['DB_FLY_PRESS','DB_FLY_PRESS_INC','PEC_DECK','CHEST_FLY_MACH','CHEST_FLY_MACH_STACK','CHEST_FLY_CABLE','CHEST_FLY_CABLE_STAND'],
  VERT_PUSH:['SHLDR_PRESS_DB','VIKING_PRESS','OHP_BB','SHLDR_PRESS_MACH','SHLDR_PRESS_MACH_STACK','SHLDR_PRESS_SMITH','SHLDR_PRESS_DB_1A'],
  HORIZ_PULL:['ROW_TBAR_CS','ROW_CS_MACH','ROW_CS_MACH_STACK','ROW_SEAL','ROW_CABLE_SEATED','ROW_CABLE_CS_1A','ROW_CABLE_CS','ROW_PENDLAY','ROW_DB_CS','ROW_DB_1A','ROW_INVERTED'],
  VERT_PULL:['CHINUP_W','PULLUP_NEUTRAL_W','PULLUP_W','PULLDOWN_CABLE','PULLDOWN_CABLE_1A','PULLDOWN_MACH','PULLDOWN_MACH_STACK','PULLDOWN_MACH_1A','PULLUP_BAND','PULLOVER_DB'],
  TRAPS:['SHRUG_MACH','SHRUG_SMITH','SHRUG_TRAP','SHRUG_BB','SHRUG_DB','SHRUG_KELSO'],
  SIDE_DELT:['LAT_RAISE_MACH','CUBAN_PRESS','LAT_RAISE_DB','LAT_RAISE_CBL_BTB','LAT_RAISE_CABLE'],
  REAR_DELT:['REAR_DELT_MACH','REAR_DELT_CBL_1A','FACE_PULL_CABLE','REAR_DELT_DB_30'],
  TRI_OH:['TRI_OH_CABLE','TRI_OH_CABLE_1A','SKULLCRUSHER_BB','TRI_OH_DB','TRI_OH_DB_INC'],
  TRI_PUSHDOWN:['TRI_PUSHDOWN','TRI_PUSHDOWN_1A'],
  BICEPS:['CURL_INCLINE_DB','CURL_BAYESIAN','CURL_EZ','CURL_BB','CURL_DB_STANDING'],
  ABS:['CRUNCH_MACH','CRUNCH_CABLE','LEG_RAISE_LYING','LEG_RAISE_CHAIR','DRAGON_FLAG_ECC'],
  NECK_CURL:['NECK_CURL_PLATE','NECK_CURL_CABLE','NECK_CURL_SEATED_CABLE','NECK_CURL_INCLINE'],
  NECK_EXT:['NECK_EXT_PLATE','NECK_EXT_PLATE_ST','NECK_EXT_SEATED_CABLE','NECK_EXT_INCLINE'],
};

// When a pool can't resolve, borrow from another. Week-uniqueness still applies,
// so the borrowed exercise differs from one already used elsewhere.
const POOL_FALLBACK = { TRI_PUSHDOWN:'TRI_OH' };

const PATTERN_LABEL = {
  SQUAT:'Squat-type', HINGE:'Hip hinge', GLUTE:'Glute', LEG_EXT:'Quad isolation',
  LEG_CURL:'Hamstring isolation', CALF:'Calf', INCLINE_PRESS:'Incline press',
  FLAT_PRESS:'Flat press', CHEST_ISO:'Chest isolation', VERT_PUSH:'Vertical push',
  HORIZ_PULL:'Horizontal pull', VERT_PULL:'Vertical pull', TRAPS:'Traps',
  SIDE_DELT:'Side delt', REAR_DELT:'Rear delt', TRI_OH:'Overhead triceps',
  TRI_PUSHDOWN:'Triceps pushdown', BICEPS:'Biceps', ABS:'Abs',
  NECK_CURL:'Neck flexion', NECK_EXT:'Neck extension',
};

// =====================================================
// RESOLVER
// =====================================================
// Some kit stands in for other kit. An adjustable bench set flat IS a flat
// bench, so someone who owns one shouldn't be told they can't bench press.
// Keyed by the requirement, valued by everything that also satisfies it.
const SATISFIED_BY = {
  [EQ.FLAT_BENCH]: [EQ.ADJ_BENCH],
  [EQ.INCLINE_STATION]: [EQ.ADJ_BENCH, EQ.RACK],
};

function has(owned, req){
  if (owned.has(req)) return true;
  const alts = SATISFIED_BY[req];
  if (!alts) return false;
  // multi-item stand-ins need every part (rack + adjustable bench for an incline station)
  if (req === EQ.INCLINE_STATION) return owned.has(EQ.ADJ_BENCH) && owned.has(EQ.RACK);
  return alts.some(a => owned.has(a));
}

function canEquip(exId, owned){ return EXERCISES[exId][1].every(r => has(owned, r)); }

// A slot is SECONDARY when it's the 2nd+ push, pull, squat or hinge of that
// session. Two flags shape what can fill it:
//   primary    - high skill, high fatigue, needs to be done fresh. Kept out of
//                secondary slots unless there's genuinely nothing else.
//   lastResort - only when nothing else works at all, repeats included.
function resolveSlot(pattern, owned, vetoed, usedThisWeek, isSecondary=false){
  const ok = (id,{allowRepeat=false, allowPrimary=false, allowLastResort=false}={}) => {
    if (vetoed.has(id)) return false;
    if (!canEquip(id,owned)) return false;
    const f = EXERCISES[id][2] || {};
    if (f.primary && isSecondary && !allowPrimary) return false;
    if (f.lastResort && !allowLastResort) return false;
    if (!allowRepeat && usedThisWeek.has(id)) return false;
    return true;
  };
  const scan = (list,opts) => { for (const id of list) if (ok(id,opts)) return id; return null; };
  const own = POOLS[pattern];
  const fb = POOL_FALLBACK[pattern] ? POOLS[POOL_FALLBACK[pattern]] : [];
  return scan(own,{})                                                      // best fit, unused
      || scan(fb,{})                                                       // borrow from fallback pool
      || scan(own,{allowRepeat:true})                                      // repeat rather than downgrade
      || scan(fb,{allowRepeat:true})
      || scan(own,{allowPrimary:true})                                     // no choice: use a primary lift
      || scan(own,{allowPrimary:true, allowRepeat:true})
      || scan(own,{allowPrimary:true, allowRepeat:true, allowLastResort:true})
      || null;
}

// =====================================================
// REP-RANGE ENGINE
// range = pattern base
//   +2 once if it's the 2nd+ PUSH/PULL/SQUAT/HINGE of the session, OR a
//     single-arm COMPOUND (never more than one +2)
//   then dumbbell widening to span 4, anchored at the bottom
// Exceptions: DB fly-press fixed 8-12; AMRAP ignores everything.
// =====================================================
const BASE = {
  SQUAT:[6,8], HINGE:[8,10], LEG_CURL:[8,12], LEG_EXT:[8,12], INCLINE_PRESS:[6,8],
  FLAT_PRESS:[6,8], CHEST_ISO:[10,12], VERT_PUSH:[6,8], HORIZ_PULL:[6,8], VERT_PULL:[6,8],
  SIDE_DELT:[10,12], REAR_DELT:[10,12], TRI_OH:[10,12], TRI_PUSHDOWN:[10,12], BICEPS:[8,12],
  CALF:[15,20], ABS:[10,12], NECK_CURL:[15,20], NECK_EXT:[15,20], GLUTE:[8,12], TRAPS:[10,15],
};
const GROUP = {
  INCLINE_PRESS:'PUSH', FLAT_PRESS:'PUSH', VERT_PUSH:'PUSH',
  HORIZ_PULL:'PULL', VERT_PULL:'PULL', SQUAT:'SQUAT', HINGE:'HINGE',
};
const SECONDARY_KEYS = new Set(['PUSH','PULL','SQUAT','HINGE']);
const COMPOUND_PATTERNS = new Set(['SQUAT','HINGE','GLUTE','INCLINE_PRESS','FLAT_PRESS','VERT_PUSH','HORIZ_PULL','VERT_PULL']);

function computeRange(pattern, exId, counters){
  const flags = EXERCISES[exId][2] || {};
  if (flags.amrap) return 'AMRAP';
  let [lo,hi] = BASE[pattern];
  const key = GROUP[pattern] || pattern;
  let secondPlus = false;
  if (SECONDARY_KEYS.has(key)){
    counters[key] = (counters[key]||0) + 1;
    secondPlus = counters[key] >= 2;
  }
  const saCounts = flags.sa && COMPOUND_PATTERNS.has(pattern);
  if (secondPlus || saCounts){ lo += 2; hi += 2; }
  if (flags.db){
    if (pattern === 'CHEST_ISO') return '8-12';
    if ((hi - lo) < 4) hi = lo + 4;
  }
  return `${lo}-${hi}`;
}

// Rest is a property of the movement's role, not the exercise.
const REST = {
  SQUAT:'3-5 min', HINGE:'3-5 min', GLUTE:'3-5 min', FLAT_PRESS:'3 min',
  INCLINE_PRESS:'3 min', VERT_PUSH:'2-3 min', HORIZ_PULL:'2-3 min', VERT_PULL:'2-3 min',
  LEG_EXT:'1-2 min', LEG_CURL:'2 min', CALF:'1 min', CHEST_ISO:'2 min', TRAPS:'2 min',
  SIDE_DELT:'1 min', REAR_DELT:'1 min', TRI_OH:'1-2 min', TRI_PUSHDOWN:'1-2 min',
  BICEPS:'1-2 min', ABS:'1-2 min', NECK_CURL:'1 min', NECK_EXT:'1 min',
};


// =====================================================
// PROGRESSION MODEL + EFFORT
// RPT (Reverse Pyramid Training) on compounds: heaviest set first, drop 5-10%
// each set, every set to 0-1 RIR. Straight Sets on isolations and small
// muscles, where RPT would drop the load too far to be useful.
// Progression on both is multi-set double progression.
// =====================================================
const PROGRESSION = {
  SQUAT:'RPT', HINGE:'RPT', GLUTE:'RPT', INCLINE_PRESS:'RPT', FLAT_PRESS:'RPT',
  VERT_PUSH:'RPT', HORIZ_PULL:'RPT', VERT_PULL:'RPT',
  LEG_EXT:'SS', LEG_CURL:'SS', CALF:'SS', CHEST_ISO:'SS', TRAPS:'SS',
  SIDE_DELT:'SS', REAR_DELT:'SS', TRI_OH:'SS', TRI_PUSHDOWN:'SS', BICEPS:'SS',
  ABS:'SS', NECK_CURL:'SS', NECK_EXT:'SS',
};
const RIR = '0-1';

// Every exercise has one landscape image showing the bottom and top of the
// movement. Filenames are derived from the exercise id, so dropping a file
// into the folder below is all that's needed — no code change. Anything not
// yet uploaded falls back to a neutral placeholder.
const IMAGE_BASE = '/exercises/';
const imageFor = exId => IMAGE_BASE + exId.toLowerCase().replace(/_/g, '-') + '.jpg';

// =====================================================
// SKELETONS — ordered movement-pattern slots
// =====================================================
const S = (pattern, opts={}) => ({pattern, ...opts});
const SKELETONS = {
  FB2:{ name:'Full Body 2x', days:1 && [
    { name:'Workout A', slots:[S('SQUAT'),S('LEG_CURL'),S('INCLINE_PRESS'),S('HORIZ_PULL'),S('SIDE_DELT'),S('TRI_OH'),S('BICEPS')] },
    { name:'Workout B', slots:[S('HINGE'),S('LEG_EXT'),S('VERT_PUSH'),S('VERT_PULL'),S('FLAT_PRESS'),S('TRI_PUSHDOWN'),S('BICEPS')] },
  ], dayCount:2, blurb:'Two complete full-body sessions. The minimum that still covers everything.' },

  FB2O:{ name:'Full Body 2x + Optional Third', days:[
    { name:'Workout A', slots:[S('SQUAT'),S('LEG_CURL'),S('INCLINE_PRESS'),S('HORIZ_PULL'),S('SIDE_DELT'),S('TRI_OH'),S('BICEPS')] },
    { name:'Workout B', slots:[S('HINGE'),S('LEG_EXT'),S('VERT_PUSH'),S('VERT_PULL'),S('FLAT_PRESS'),S('TRI_PUSHDOWN'),S('BICEPS')] },
    { name:'Workout C (optional)', slots:[S('FLAT_PRESS'),S('HORIZ_PULL'),S('VERT_PUSH'),S('SIDE_DELT'),S('CALF'),S('ABS')] },
  ], dayCount:2, blurb:'Two complete sessions plus a third that shares no exercises with them. Run it in the weeks you can, skip it in the weeks you cannot.' },

  ULU3:{ name:'Upper / Lower / Upper', days:[
    { name:'Upper 1', slots:[S('INCLINE_PRESS'),S('HORIZ_PULL'),S('VERT_PUSH'),S('CHEST_ISO'),S('BICEPS'),S('REAR_DELT')] },
    { name:'Lower',   slots:[S('SQUAT'),S('GLUTE'),S('LEG_EXT'),S('LEG_CURL'),S('CALF'),S('ABS')] },
    { name:'Upper 2', slots:[S('VERT_PULL'),S('VERT_PUSH'),S('FLAT_PRESS'),S('HORIZ_PULL'),S('TRAPS'),S('TRI_OH'),S('SIDE_DELT')] },
  ], dayCount:3, blurb:'Upper body twice, lower once. Favours the torso.' },

  FB3:{ name:'Full Body 3x', days:[
    { name:'Workout A', slots:[S('SQUAT'),S('LEG_CURL'),S('VERT_PULL'),S('VERT_PUSH'),S('FLAT_PRESS'),S('BICEPS'),S('REAR_DELT')] },
    { name:'Workout B', slots:[S('HINGE'),S('LEG_EXT'),S('INCLINE_PRESS'),S('HORIZ_PULL'),S('TRI_OH'),S('SIDE_DELT')] },
    { name:'Workout C', slots:[S('SQUAT'),S('VERT_PUSH'),S('VERT_PULL'),S('HORIZ_PULL'),S('CHEST_ISO'),S('BICEPS'),S('TRI_PUSHDOWN')] },
  ], dayCount:3, blurb:'Every muscle three times a week. Highest frequency, most balanced.' },

  UL4:{ name:'Upper / Lower 4x', days:[
    { name:'Lower 1', slots:[S('SQUAT'),S('HINGE'),S('CALF'),S('NECK_CURL',{optional:true}),S('NECK_EXT',{optional:true})] },
    { name:'Upper 1', slots:[S('FLAT_PRESS'),S('HORIZ_PULL'),S('VERT_PUSH'),S('VERT_PULL'),S('BICEPS'),S('TRI_PUSHDOWN'),S('REAR_DELT')] },
    { name:'Lower 2', slots:[S('GLUTE'),S('SQUAT'),S('LEG_CURL'),S('LEG_EXT'),S('CALF'),S('ABS')] },
    { name:'Upper 2', slots:[S('VERT_PULL'),S('INCLINE_PRESS'),S('HORIZ_PULL'),S('FLAT_PRESS'),S('TRAPS'),S('BICEPS'),S('TRI_OH'),S('SIDE_DELT')] },
  ], dayCount:4, blurb:'Everything twice a week, split cleanly down the middle.' },

  PPLU:{ name:'Push / Pull / Legs / Upper', days:[
    { name:'Push',  slots:[S('INCLINE_PRESS'),S('FLAT_PRESS'),S('TRI_OH'),S('SIDE_DELT'),S('ABS')] },
    { name:'Pull',  slots:[S('VERT_PULL'),S('HORIZ_PULL'),S('BICEPS'),S('REAR_DELT'),S('NECK_CURL',{optional:true}),S('NECK_EXT',{optional:true})] },
    { name:'Legs',  slots:[S('SQUAT'),S('HINGE'),S('LEG_EXT'),S('LEG_CURL'),S('CALF')] },
    { name:'Upper', slots:[S('TRAPS'),S('VERT_PUSH'),S('VERT_PULL'),S('FLAT_PRESS'),S('BICEPS'),S('TRI_PUSHDOWN')] },
  ], dayCount:4, blurb:'Classic push/pull/legs with an extra upper day to lift torso frequency.' },

  PPLE:{ name:'Push / Pull, Legs Every Session', days:[
    { name:'Day 1', slots:[S('HINGE'),S('FLAT_PRESS'),S('VERT_PUSH'),S('CHEST_ISO'),S('TRI_OH'),S('NECK_CURL',{optional:true}),S('NECK_EXT',{optional:true})] },
    { name:'Day 2', slots:[S('SQUAT'),S('VERT_PULL'),S('HORIZ_PULL'),S('BICEPS'),S('REAR_DELT'),S('CALF')] },
    { name:'Day 3', slots:[S('SQUAT'),S('INCLINE_PRESS'),S('VERT_PUSH'),S('FLAT_PRESS'),S('TRI_PUSHDOWN'),S('SIDE_DELT')] },
    { name:'Day 4', slots:[S('VERT_PULL'),S('HORIZ_PULL'),S('TRAPS'),S('BICEPS'),S('LEG_CURL'),S('LEG_EXT'),S('CALF')] },
  ], dayCount:4, blurb:'Push and pull upper work, with leg training spread across every session instead of stacked into one.' },

  D5:{ name:'Lower / Torso / Arms / Lower / Upper', days:[
    { name:'Lower 1', slots:[S('SQUAT'),S('HINGE'),S('LEG_EXT'),S('LEG_CURL'),S('CALF'),S('ABS')] },
    { name:'Torso',   slots:[S('INCLINE_PRESS'),S('HORIZ_PULL'),S('CHEST_ISO'),S('VERT_PULL'),S('REAR_DELT')] },
    { name:'Arms',    slots:[S('VERT_PUSH'),S('BICEPS'),S('TRI_OH'),S('BICEPS'),S('TRI_PUSHDOWN'),S('SIDE_DELT')] },
    { name:'Lower 2', slots:[S('GLUTE'),S('SQUAT'),S('LEG_CURL'),S('ABS'),S('NECK_CURL',{optional:true}),S('NECK_EXT',{optional:true})] },
    { name:'Upper',   slots:[S('VERT_PULL'),S('FLAT_PRESS'),S('HORIZ_PULL'),S('CHEST_ISO'),S('TRAPS'),S('REAR_DELT')] },
  ], dayCount:5, blurb:'Five shorter sessions with a dedicated arm day. Most volume, most frequency.' },
};
// FB2 uses a guard above purely for readability; normalise it here.
SKELETONS.FB2.days = [
  { name:'Workout A', slots:[S('SQUAT'),S('LEG_CURL'),S('INCLINE_PRESS'),S('HORIZ_PULL'),S('SIDE_DELT'),S('TRI_OH'),S('BICEPS')] },
  { name:'Workout B', slots:[S('HINGE'),S('LEG_EXT'),S('VERT_PUSH'),S('VERT_PULL'),S('FLAT_PRESS'),S('TRI_PUSHDOWN'),S('BICEPS')] },
];

const SKELETONS_BY_DAYS = days => Object.entries(SKELETONS).filter(([,s]) => s.dayCount === days);

// =====================================================
// PROGRAM BUILDER
// =====================================================
function buildProgram(skelId, owned, vetoed = new Set()){
  const skel = SKELETONS[skelId];

  // Flatten the week and mark which slots are secondary. This depends only on
  // the skeleton's slot order, not on what ends up filling them.
  const flat = [];
  skel.days.forEach((day, di) => {
    const counters = {};
    day.slots.forEach((slot, ri) => {
      const key = GROUP[slot.pattern] || slot.pattern;
      let isSecondary = false;
      if (SECONDARY_KEYS.has(key)){
        counters[key] = (counters[key] || 0) + 1;
        isSecondary = counters[key] >= 2;
      }
      flat.push({ di, ri, slot, isSecondary });
    });
  });

  // Resolve every primary slot before any secondary one, so the best exercise
  // in a pool lands in the slot that can actually do it justice rather than
  // whichever day happens to come first in the week.
  const order = [...flat.filter(f => !f.isSecondary), ...flat.filter(f => f.isSecondary)];
  const usedThisWeek = new Set();
  const picked = {};
  const unserviceable = [];
  for (const f of order){
    const exId = resolveSlot(f.slot.pattern, owned, vetoed, usedThisWeek, f.isSecondary);
    if (!exId){ unserviceable.push(f.slot.pattern); continue; }
    usedThisWeek.add(exId);
    picked[`${f.di}:${f.ri}`] = exId;
  }

  // Rebuild in reading order and compute rep ranges per session.
  const days = skel.days.map((day, di) => {
    const counters = {};
    const rows = day.slots.map((slot, ri) => {
      const exId = picked[`${di}:${ri}`];
      if (!exId) return { slot, exId:null, range:null, rest:null };
      return { slot, exId, range: computeRange(slot.pattern, exId, counters), rest: REST[slot.pattern] };
    });
    return { name: day.name, rows };
  });
  return { skelId, name: skel.name, days, unserviceable: [...new Set(unserviceable)] };
}

// =====================================================
// OP CODE — schema v1.  OP1-<base64url(payload)>-<checksum>
// payload = seq | skeletonId | exerciseTokens
// Stores PERMANENT exercise ids, never pool positions, so growing a pool can
// never change what an existing code decodes to. Rep ranges are recomputed on
// decode, so retuning a base range updates every code that reloads.
// =====================================================
// FROZEN TOKEN ORDER. Tokens are positions in this list, so the list is
// APPEND-ONLY: never sort it, never reorder it, never remove an entry. Removing
// or reordering would change what every previously issued code decodes to.
// New exercises go on the end. Retired ones stay in place as dead slots.
const TOKEN_ORDER = [
  'BACK_EXT_WTD','BENCH_BB','BENCH_DB_FLAT','CALF_SEATED','CALF_SL_BW','CALF_STRAIGHT_DB',
  'CALF_STRAIGHT_M','CALF_STRAIGHT_SM','CHEST_FLY_CABLE','CHEST_FLY_MACH','CHEST_PRESS_MACH','CHINUP_W',
  'CRUNCH_CABLE','CRUNCH_MACH','CUBAN_PRESS','CURL_BAYESIAN','CURL_BB','CURL_DB_STANDING',
  'CURL_EZ','CURL_INCLINE_DB','DB_FLY_PRESS','DB_FLY_PRESS_INC','FACE_PULL_CABLE','HACK_SQUAT',
  'HIP_THRUST_BB','HIP_THRUST_BENCH','HIP_THRUST_DB_1L','HIP_THRUST_MACH','HIP_THRUST_SMITH','INC_BB_15',
  'INC_BB_30','INC_DB_15','INC_DB_30','INC_PRESS_MACH','LAT_RAISE_CABLE','LAT_RAISE_CBL_BTB',
  'LAT_RAISE_DB','LAT_RAISE_MACH','LEG_CURL_LYING','LEG_CURL_SEATED','LEG_EXT','LEG_PRESS',
  'LEG_RAISE_CHAIR','LEG_RAISE_LYING','NECK_CURL_CABLE','NECK_CURL_PLATE','NECK_EXT_PLATE','NECK_EXT_PLATE_ST',
  'NORDIC_BAND','OHP_BB','PEC_DECK','PENDULUM_SQUAT','PULLDOWN_CABLE','PULLDOWN_CABLE_1A',
  'PULLDOWN_MACH','PULLDOWN_MACH_1A','PULLOVER_DB','PULLUP_BAND','PULLUP_NEUTRAL_W','PULLUP_W',
  'RDL_BB','RDL_CABLE','RDL_DB','RDL_LANDMINE','RDL_LEVER','RDL_SMITH',
  'RDL_TRAP','REAR_DELT_CBL_1A','REAR_DELT_DB_30','REAR_DELT_MACH','REVERSE_NORDIC','ROW_CABLE_CS_1A',
  'ROW_CABLE_SEATED','ROW_CS_MACH','ROW_DB_1A','ROW_INVERTED','ROW_PENDLAY','ROW_SEAL',
  'ROW_TBAR_CS','SHLDR_PRESS_DB','SHLDR_PRESS_DB_1A','SHLDR_PRESS_MACH','SHLDR_PRESS_SMITH','SHRUG_DB',
  'SHRUG_MACH','SHRUG_SMITH','SHRUG_TRAP','SKULLCRUSHER_BB','SPLIT_SQUAT_BULG','SQUAT_BACK',
  'SQUAT_FRONT','SQUAT_SMITH','TRI_OH_CABLE','TRI_OH_CABLE_1A','TRI_OH_DB','TRI_OH_DB_INC',
  'TRI_PUSHDOWN','TRI_PUSHDOWN_1A','VIKING_PRESS',
];
// Anything in the library but not yet in TOKEN_ORDER is appended automatically,
// which keeps existing tokens stable while new exercises still encode.
const ID_LIST = [...TOKEN_ORDER, ...Object.keys(EXERCISES).filter(id => !TOKEN_ORDER.includes(id)).sort()];
const ID_TO_TOKEN = {}; const TOKEN_TO_ID = {};
ID_LIST.forEach((id,i)=>{ ID_TO_TOKEN[id]=i.toString(36); TOKEN_TO_ID[i.toString(36)]=id; });

const b64url = s => btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const unb64url = s => atob(s.replace(/-/g,'+').replace(/_/g,'/'));
function checksum2(str){ let h=0; for(let i=0;i<str.length;i++) h=(h*31+str.charCodeAt(i))%1296; return h.toString(36).padStart(2,'0'); }

function encodeProgram(prog, seq = 1){
  const tokens = [];
  prog.days.forEach(d => d.rows.forEach(r => tokens.push(r.exId ? ID_TO_TOKEN[r.exId] : '-')));
  const payload = `${seq}|${prog.skelId}|${tokens.join(',')}`;
  return `OP1-${b64url(payload)}-${checksum2(payload)}`;
}

function decodeProgram(code){
  const m = String(code).trim().match(/^OP1-([A-Za-z0-9\-_]+)-([a-z0-9]{2})$/);
  if (!m) return { ok:false, error:"That doesn't look like an OptiWorkout code. They start with OP1." };
  let payload;
  try { payload = unb64url(m[1]); } catch { return { ok:false, error:'That code is damaged. Check it was copied in full.' }; }
  if (checksum2(payload) !== m[2]) return { ok:false, error:'That code failed its check. A character is likely missing or mistyped.' };
  const [seqStr, skelId, tokenStr] = payload.split('|');
  const skel = SKELETONS[skelId];
  if (!skel) return { ok:false, error:'That code is for a program type this version no longer has.' };
  const tokens = tokenStr.split(',');
  const total = skel.days.reduce((n,d)=>n+d.slots.length,0);
  if (tokens.length !== total) return { ok:false, error:'That code is incomplete.' };
  const days = []; let i = 0;
  for (const d of skel.days){
    const counters = {}; const rows = [];
    for (const slot of d.slots){
      const tok = tokens[i++];
      if (tok === '-'){ rows.push({slot, exId:null, range:null, rest:null}); continue; }
      const exId = TOKEN_TO_ID[tok];
      if (!exId) return { ok:false, error:'That code refers to an exercise this version does not have.' };
      rows.push({ slot, exId, range: computeRange(slot.pattern, exId, counters), rest: REST[slot.pattern] });
    }
    days.push({ name:d.name, rows });
  }
  return { ok:true, seq:parseInt(seqStr,10)||1, skelId, name:skel.name, days, unserviceable:[] };
}

// =====================================================
// SS1 — PhysiquePlan code reader (continuity only, nothing load-bearing)
// =====================================================
const TIER_NAME = ['novice','intermediate','proficient','advanced'];
const TIER_PHRASE = ['novice-level','intermediate','proficient-level','advanced'];
// Leanness read off the archetype, without naming the archetype itself.
const ARCHETYPE_LEANNESS = [
  'high body fat','enough body fat to blur what you have','moderate body fat','low body fat',
  'significant body fat','moderate body fat','low body fat','significant body fat',
  'moderate body fat','low body fat','significant body fat','moderate body fat','low body fat',
];

function decodeSS1(code){
  const m = String(code).trim().match(/^SS1-([A-Za-z0-9\-_]+)-([a-z0-9]{2})$/);
  if (!m) return { ok:false, error:"That doesn't look like a PhysiquePlan code. They start with SS1." };
  let payload;
  try { payload = unb64url(m[1]); } catch { return { ok:false, error:'That code is damaged. Check it was copied in full.' }; }
  if (checksum2(payload) !== m[2]) return { ok:false, error:'That code failed its check. A character is likely missing or mistyped.' };
  const f = payload.split('|');
  if (f.length < 12) return { ok:false, error:'That code is from an older version and is missing information.' };
  return {
    ok:true,
    units: f[0] === 'i' ? 'imperial' : 'metric',
    heightCm: parseFloat(f[2]),
    weightKg: parseFloat(f[3]),
    tier: TIER_NAME[parseInt(f[4],10)] || 'intermediate',
    tierIdx: parseInt(f[4],10) || 0,
    archetypeId: parseInt(f[7],10) || 0,
    direction: f[8] === 'c' ? 'cut' : 'bulk',
    goalLow: parseFloat(f[9]),
    goalHigh: parseFloat(f[10]),
  };
}

const kgToLb = kg => Math.round(kg * 2.20462);
const fmtW = (kg, units) => units === 'imperial' ? `${kgToLb(kg)} lb` : `${Math.round(kg)} kg`;
const fmtRange = (lo, hi, units) => units === 'imperial'
  ? `${kgToLb(lo)}-${kgToLb(hi)} lb` : `${Math.round(lo)}-${Math.round(hi)} kg`;
const fmtH = (cm, units) => {
  if (units !== 'imperial') return `${Math.round(cm)} cm`;
  const t = cm / 2.54, ft = Math.floor(t / 12);
  return `${ft}'${Math.round(t - ft * 12)}"`;
};

// =====================================================
// EQUIPMENT PICKER GROUPS
// =====================================================
const EQUIPMENT_GROUPS = [
  { label:'Free weights', items:[EQ.BARBELL,EQ.DUMBBELLS,EQ.EZ_BAR,EQ.TRAP_BAR,EQ.PLATE] },
  { label:'Racks & benches', items:[EQ.RACK,EQ.FLAT_BENCH,EQ.ADJ_BENCH,EQ.INCLINE_STATION,EQ.SMITH,EQ.LANDMINE,EQ.LEVER_ARMS] },
  { label:'Cables & bars', items:[EQ.CABLE,EQ.LAT_PULLDOWN,EQ.PULLUP_BAR,EQ.NEUTRAL_BARS,EQ.WEIGHT_BELT,EQ.BANDS] },
  { label:'Leg machines', items:[EQ.HACK,EQ.PENDULUM,EQ.LEG_PRESS_M,EQ.LEG_EXT_M,EQ.LEG_CURL_SEATED_M,EQ.LEG_CURL_LYING_M,EQ.LEG_CURL_KNEELING_M,EQ.CALF_STANDING_M,EQ.CALF_SEATED_M,EQ.CALF_SEATED_STRAIGHT_M,EQ.HIP_THRUST_M,EQ.HIP_THRUST_STATION] },
  { label:'Upper body machines', items:[EQ.CHEST_PRESS_M,EQ.INCLINE_PRESS_M,EQ.PEC_DECK,EQ.CHEST_FLY_M,EQ.SHOULDER_PRESS_M,EQ.LAT_RAISE_M,EQ.REAR_DELT_M,EQ.ROW_CS_M,EQ.TBAR_M,EQ.PULLDOWN_M,EQ.SHRUG_M,EQ.VIKING,EQ.SEAL_BENCH] },
  { label:'Other', items:[EQ.STEPPER,EQ.ROMAN_CHAIR,EQ.CRUNCH_M,EQ.CAPTAINS_CHAIR,EQ.HEAD_HARNESS] },
];

const PRESET_FULL = new Set(Object.values(EQ));
// A large commercial gym: everything except the genuinely rare specialist
// kit. A well-stocked chain gym, but not one with a pendulum squat or a
// seated straight-leg calf machine.
const LARGE_GYM_EXCLUDE = new Set([
  EQ.TRAP_BAR, EQ.LEVER_ARMS, EQ.SEAL_BENCH, EQ.PENDULUM, EQ.CALF_SEATED_STRAIGHT_M,
  EQ.LEG_CURL_KNEELING_M, EQ.VIKING, EQ.SHRUG_M, EQ.HEAD_HARNESS,
]);
const PRESET_LARGE = new Set(Object.values(EQ).filter(e => !LARGE_GYM_EXCLUDE.has(e)));
// A well-equipped commercial gym, but not a specialist one. No seated
// straight-leg calf machine, no pendulum, no hack squat, no lever arms.
const PRESET_MID = new Set([
  EQ.BARBELL,EQ.DUMBBELLS,EQ.EZ_BAR,EQ.RACK,EQ.FLAT_BENCH,EQ.ADJ_BENCH,EQ.INCLINE_STATION,
  EQ.CABLE,EQ.LAT_PULLDOWN,EQ.PULLUP_BAR,EQ.WEIGHT_BELT,EQ.SMITH,EQ.LEG_PRESS_M,EQ.LEG_EXT_M,
  EQ.LEG_CURL_SEATED_M,EQ.CALF_STANDING_M,EQ.CALF_SEATED_M,
  EQ.CHEST_PRESS_M,EQ.PEC_DECK,EQ.SHOULDER_PRESS_M,EQ.LAT_RAISE_M,EQ.REAR_DELT_M,
  EQ.ROW_CS_M,EQ.CRUNCH_M,EQ.ROMAN_CHAIR,EQ.CAPTAINS_CHAIR,EQ.STEPPER,EQ.PLATE,EQ.BANDS,
]);
// No dedicated flat bench station — an adjustable bench set flat covers
// everything, and SATISFIED_BY makes the swap for us.
const PRESET_GARAGE = new Set([
  EQ.BARBELL,EQ.DUMBBELLS,EQ.RACK,EQ.ADJ_BENCH,EQ.PULLUP_BAR,
  EQ.WEIGHT_BELT,EQ.PLATE,EQ.STEPPER,EQ.BANDS,
]);

// =====================================================
// UI PRIMITIVES — matched to the ShredSmart suite
// =====================================================
// Long screens (the program list) hang from the top; short ones (loading,
// errors) sit centred the way PhysiquePlan does.
const Shell = ({children, center=false}) => (
  <div className="min-h-screen bg-stone-50 flex flex-col">
    <header className="w-full px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-white">
      <span className="font-semibold text-stone-900 tracking-tight">ShredSmart™</span>
      <span className="text-xs text-stone-500 tracking-wider">OptiWorkout™</span>
    </header>
    <main className={`flex-1 flex ${center ? 'items-center' : 'items-start'} justify-center px-4 py-8`}>{children}</main>
    <footer className="w-full px-6 py-4 border-t border-stone-200 bg-white text-xs text-stone-500 flex justify-between">
      <span>ShredSmart™</span><span>OptiWorkout™</span>
    </footer>
  </div>
);

const Card = ({children, className=''}) => (
  <div className={`bg-white border border-stone-200 rounded-2xl shadow-sm p-8 w-full ${className}`}>{children}</div>
);

const PrimaryButton = ({children, onClick, disabled, className=''}) => (
  <button onClick={onClick} disabled={disabled}
    className={`w-full ${disabled ? 'bg-stone-300 cursor-not-allowed text-stone-500' : 'bg-stone-900 hover:bg-stone-800 text-white'} font-medium py-3.5 px-6 rounded-full transition-colors flex items-center justify-center gap-2 ${className}`}>
    {children}
  </button>
);

const SecondaryButton = ({children, onClick, className=''}) => (
  <button onClick={onClick}
    className={`w-full bg-stone-100 hover:bg-stone-200 text-stone-900 font-medium py-3.5 px-6 rounded-full transition-colors flex items-center justify-center gap-2 ${className}`}>
    {children}
  </button>
);

const BackButton = ({onClick}) => (
  <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-900 transition-colors mb-4">
    <ArrowLeft className="w-4 h-4" /> Back
  </button>
);

const Eyebrow = ({children}) => (
  <span className="text-xs font-semibold text-orange-600 tracking-widest">{children}</span>
);

const StepBar = ({current, total}) => (
  <div className="flex items-center gap-2 mb-8">
    {Array.from({length: total}).map((_,i) => (
      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= current ? 'bg-orange-500' : 'bg-stone-200'}`} />
    ))}
  </div>
);

// Landscape before/after frame. Renders the real image when one exists,
// otherwise a labelled two-panel placeholder so the layout is already correct.
// Exercise images are 1000 x 600 (5:3). The frame matches that ratio exactly,
// and object-contain guarantees the whole movement stays visible even if an
// image is exported at a slightly different size.
const ExerciseImage = ({exId, className=''}) => {
  const [failed, setFailed] = useState(false);
  const name = EXERCISES[exId][0];
  if (failed) return (
    <div className={`rounded-lg border border-stone-200 bg-stone-100 aspect-[5/3] ${className}`} />
  );
  return (
    <div className={`rounded-lg overflow-hidden bg-white border border-stone-200 aspect-[5/3] ${className}`}>
      <img src={imageFor(exId)} alt={name} onError={() => setFailed(true)}
        className="w-full h-full object-contain" />
    </div>
  );
};

const Modal = ({children, onClose}) => (
  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-900/40 px-0 sm:px-4 py-0 sm:py-8"
       onClick={onClose}>
    <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[88vh] flex flex-col"
         onClick={e => e.stopPropagation()}>
      {children}
    </div>
  </div>
);

// =====================================================
// SCREENS
// =====================================================
function HomeScreen({onContinue, onCustom, onReload}){
  return (
    <Card className="max-w-3xl">
      <div className="grid md:grid-cols-2 gap-10 items-center">
        <div>
          <Eyebrow>OptiWorkout™</Eyebrow>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold text-stone-900 tracking-tight leading-tight">
            Build the best program your <em className="italic font-semibold text-orange-600">gym and schedule</em> allow.
          </h1>
          <p className="mt-4 text-stone-600 leading-relaxed">
            Tell us what equipment you have and how often you can train. You'll get a complete
            program built around both, and the exact way to progress on it.
          </p>
        </div>
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-6">
          <h2 className="font-semibold text-stone-900">What you'll get</h2>
          <ul className="mt-3 space-y-2.5 text-sm text-stone-700">
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <span>An effective workout program built around your time constraints and preferences</span>
            </li>
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <span>Every exercise matched to the equipment you actually have</span>
            </li>
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <span>Sets, reps, rest and effort for every movement</span>
            </li>
            <li className="flex gap-2">
              <Check className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
              <span>The progression model that turns the program into results</span>
            </li>
          </ul>
          <div className="mt-5 space-y-2.5">
            <PrimaryButton onClick={onContinue}>Continue from PhysiquePlan <ArrowRight className="w-4 h-4" /></PrimaryButton>
            <SecondaryButton onClick={onCustom}>Build a custom program</SecondaryButton>
            <SecondaryButton onClick={onReload}>Reload a program</SecondaryButton>
          </div>
          <p className="text-xs text-stone-500 text-center mt-3">Takes about 3 minutes.</p>
        </div>
      </div>
    </Card>
  );
}

function PasteCodeScreen({onBack, onDecoded}){
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const r = decodeSS1(code);
    if (!r.ok) return setError(r.error);
    onDecoded(r);
  };
  return (
    <Card className="max-w-xl">
      <BackButton onClick={onBack} />
      <Eyebrow>Step 1</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">Paste your PhysiquePlan code.</h2>
      <p className="mt-2 text-stone-600 text-sm leading-relaxed">
        It starts with SS1. You'll find it on your PhysiquePlan results screen.
      </p>
      <input value={code} onChange={e => { setCode(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && submit()} placeholder="SS1-..."
        className="mt-6 w-full px-4 py-3.5 rounded-xl border border-stone-300 focus:border-orange-500 focus:outline-none font-mono text-sm" />
      {error && <p className="mt-3 text-sm text-orange-700 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</p>}
      <PrimaryButton onClick={submit} disabled={!code.trim()} className="mt-6">
        Continue <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
}

function AcknowledgeScreen({ss1, onBack, onContinue}){
  const leanness = ARCHETYPE_LEANNESS[ss1.archetypeId] || 'moderate body fat';
  const goal = fmtRange(ss1.goalLow, ss1.goalHigh, ss1.units);
  return (
    <Card className="max-w-xl">
      <BackButton onClick={onBack} />
      <Eyebrow>Your plan so far</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">Your PhysiquePlan results are in.</h2>
      <div className="mt-5 bg-stone-50 border border-stone-200 rounded-xl p-5">
        <p className="text-stone-900 leading-relaxed">
          At {fmtH(ss1.heightCm, ss1.units)} and {fmtW(ss1.weightKg, ss1.units)}, you have{' '}
          <span className="font-semibold">{TIER_PHRASE[ss1.tierIdx]} muscle development</span> and {leanness}.
        </p>
      </div>
      <div className="mt-5 text-stone-600 leading-relaxed space-y-4">
        {ss1.direction === 'cut' ? (
          <>
            <p>
              You're on a cut, heading toward {goal}. That shapes what your training needs to do: hold
              onto every bit of muscle while the fat comes off.
            </p>
            <p>
              And if you're coming in undertrained, expect more than that. On a real program with real
              intensity, most lifters in your position build muscle while they lose fat — the
              recomposition that makes the difference between looking smaller at the end and looking
              better. That's what this training is built to drive.
            </p>
          </>
        ) : (
          <p>
            You're on a lean bulk, heading toward {goal}. That's what your training is built around:
            progressive overload on the movements that add size, enough volume to grow, structured so
            the weight you gain is muscle and not just weight.
          </p>
        )}
      </div>
      <PrimaryButton onClick={onContinue} className="mt-7">
        Build my program <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
}

function DaysScreen({onBack, onPick, step, total}){
  const options = [
    { n:2, label:'2 days', note:'A tight schedule, or training around another sport.' },
    { n:3, label:'3 days', note:'The most common sustainable commitment.' },
    { n:4, label:'4 days', note:'Serious training with room for recovery.' },
    { n:5, label:'5 days', note:'Shorter sessions, higher frequency.' },
  ];
  return (
    <Card className="max-w-xl">
      <BackButton onClick={onBack} />
      <StepBar current={step} total={total} />
      <Eyebrow>Schedule</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">
        How many days a week can you train without missing workouts?
      </h2>
      <p className="mt-2 text-stone-600 text-sm leading-relaxed">
        Not what you'd like to do. What you're sure you can sustain for the next three months, even through your most chaotic and
        stressful periods. A 3-day program you stick to
        consistently beats a 5-day program where you often skip workouts.
      </p>
      <div className="mt-6 space-y-2">
        {options.map(o => (
          <button key={o.n} onClick={() => onPick(o.n)}
            className="w-full text-left p-5 rounded-xl border border-stone-200 hover:border-orange-500 hover:bg-orange-50 transition-colors">
            <div className="font-semibold text-stone-900">{o.label}</div>
            <div className="text-xs text-stone-500 mt-0.5">{o.note}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function SplitScreen({days, onBack, onPick, step, total}){
  const options = SKELETONS_BY_DAYS(days);
  return (
    <Card className="max-w-xl">
      <BackButton onClick={onBack} />
      <StepBar current={step} total={total} />
      <Eyebrow>Structure</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">
        {options.length > 1 ? 'Which structure fits you better?' : 'Your structure'}
      </h2>
      <p className="mt-2 text-stone-600 text-sm leading-relaxed">
        {options.length > 1
          ? "Both work at this frequency. Pick the one you'd rather run."
          : "At this frequency there's one structure worth running."}
      </p>
      <div className="mt-6 space-y-2">
        {options.map(([id, s]) => (
          <button key={id} onClick={() => onPick(id)}
            className="w-full text-left p-5 rounded-xl border border-stone-200 hover:border-orange-500 hover:bg-orange-50 transition-colors">
            <div className="font-semibold text-stone-900">{s.name}</div>
            <div className="text-xs text-stone-500 mt-1 leading-relaxed">{s.blurb}</div>
          </button>
        ))}
      </div>
    </Card>
  );
}

function EquipmentScreen({onBack, onContinue, owned, setOwned, step, total}){
  const toggle = item => {
    const next = new Set(owned);
    next.has(item) ? next.delete(item) : next.add(item);
    setOwned(next);
  };
  const preset = set => setOwned(new Set(set));
  return (
    <Card className="max-w-2xl">
      <BackButton onClick={onBack} />
      <StepBar current={step} total={total} />
      <Eyebrow>Your gym</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">What do you have access to?</h2>
      <p className="mt-2 text-stone-600 text-sm leading-relaxed">
        Only tick what's available and usable for you.
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={() => preset(PRESET_FULL)} className="px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-800 transition-colors">Everything</button>
        <button onClick={() => preset(PRESET_LARGE)} className="px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-800 transition-colors">Large commercial gym</button>
        <button onClick={() => preset(PRESET_MID)} className="px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-800 transition-colors">Standard gym</button>
        <button onClick={() => preset(PRESET_GARAGE)} className="px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-800 transition-colors">Garage gym</button>
        <button onClick={() => preset([])} className="px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-800 transition-colors">Clear</button>
      </div>
      <div className="mt-6 space-y-5 max-h-[26rem] overflow-y-auto pr-1">
        {EQUIPMENT_GROUPS.map(g => (
          <div key={g.label}>
            <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{g.label}</div>
            <div className="grid sm:grid-cols-2 gap-1.5">
              {g.items.map(item => (
                <button key={item} onClick={() => toggle(item)}
                  className={`text-left px-3.5 py-2.5 rounded-lg border text-sm transition-colors flex items-center gap-2.5 ${
                    owned.has(item) ? 'border-orange-500 bg-orange-50 text-stone-900' : 'border-stone-200 text-stone-600 hover:border-stone-300'}`}>
                  <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center ${owned.has(item) ? 'bg-orange-500' : 'border border-stone-300'}`}>
                    {owned.has(item) && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="capitalize">{item}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <PrimaryButton onClick={onContinue} disabled={owned.size === 0} className="mt-6">
        Build my program <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
}

// ---- SWAP MENU ----------------------------------------------------
// Every option for this slot, in preference order, with its image and its
// availability. One tap replaces the exercise — no repeated rejecting.
function SwapMenu({row, prog, di, ri, owned, onPick, onClose}){
  const pattern = row.slot.pattern;
  const used = new Set();
  prog.days.forEach((d, dj) => d.rows.forEach((r, rj) => {
    if (r.exId && !(dj === di && rj === ri)) used.add(r.exId);
  }));
  const pool = [...POOLS[pattern], ...(POOL_FALLBACK[pattern] ? POOLS[POOL_FALLBACK[pattern]] : [])];
  const available = pool.filter(id => canEquip(id, owned));
  const missing = pool.filter(id => !canEquip(id, owned));

  const Option = ({id}) => {
    const equipped = canEquip(id, owned);
    const dup = used.has(id);
    const current = id === row.exId;
    return (
      <button onClick={() => onPick(id)} disabled={current}
        className={`w-full text-left p-3 rounded-xl border transition-colors flex gap-3 ${
          current ? 'border-orange-500 bg-orange-50 cursor-default'
                  : 'border-stone-200 hover:border-orange-500 hover:bg-orange-50'}`}>
        <ExerciseImage exId={id} className="w-28 sm:w-32 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-stone-900">{EXERCISES[id][0]}</div>
          <div className="text-xs mt-1 leading-relaxed">
            {current && <span className="text-orange-700 font-medium">Currently selected</span>}
            {!current && !equipped && <span className="text-stone-500">Needs {EXERCISES[id][1].join(', ')}</span>}
            {!current && equipped && dup && <span className="text-stone-500">Already elsewhere in your week</span>}
            {!current && equipped && !dup && <span className="text-stone-500">Available in your gym</span>}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Modal onClose={onClose}>
      <div className="p-5 border-b border-stone-200 flex items-start justify-between gap-4">
        <div>
          <Eyebrow>{PATTERN_LABEL[pattern]}</Eyebrow>
          <h3 className="mt-1.5 text-lg font-bold text-stone-900">Choose your exercise</h3>
          <p className="text-xs text-stone-500 mt-1">Any of these trains the same pattern. Pick what you'd rather do.</p>
        </div>
        <button onClick={onClose} className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors">
          <X className="w-4 h-4 text-stone-500" />
        </button>
      </div>
      <div className="p-5 overflow-y-auto space-y-2">
        {available.map(id => <Option key={id} id={id} />)}
        {missing.length > 0 && (
          <>
            <div className="pt-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">
              Not available with your equipment
            </div>
            {missing.map(id => <Option key={id} id={id} />)}
          </>
        )}
      </div>
    </Modal>
  );
}

// ---- one exercise row, shared by review + final --------------------
const ExerciseRow = ({row, onSwap, detailed}) => {
  if (!row.exId) return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex-1">
        <div className="text-sm font-medium text-stone-400">No option available</div>
        <div className="text-xs text-stone-400 mt-0.5">{PATTERN_LABEL[row.slot.pattern]}</div>
      </div>
    </div>
  );
  const prog = PROGRESSION[row.slot.pattern];
  const isAmrap = row.range === 'AMRAP';
  return (
    <div className="flex gap-3 px-4 py-3">
      <ExerciseImage exId={row.exId} className="w-28 sm:w-36 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="text-sm font-medium text-stone-900 leading-snug">
            {EXERCISES[row.exId][0]}
            {row.slot.optional && <span className="text-stone-400 font-normal"> · optional</span>}
          </div>
          {onSwap && (
            <button onClick={onSwap}
              className="flex-shrink-0 text-sm font-medium text-orange-600 hover:text-orange-700 transition-colors">
              Swap
            </button>
          )}
        </div>
        <div className="text-xs text-stone-500 mt-1">{PATTERN_LABEL[row.slot.pattern]}</div>
        {detailed ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
            <span><span className="text-stone-400">Reps</span> {row.range}</span>
            <span><span className="text-stone-400">Rest</span> {row.rest}</span>
            {!isAmrap && <span><span className="text-stone-400">RIR</span> {RIR}</span>}
            <span><span className="text-stone-400">Model</span> {isAmrap ? 'AMRAP' : prog}</span>
          </div>
        ) : (
          <div className="mt-1 text-xs text-stone-500">{row.range} reps · rest {row.rest}</div>
        )}
      </div>
    </div>
  );
};

// Matches PhysiquePlan's loading screen: a spinner, two lines, 2 seconds.
const LoadingScreen = ({ message = 'Building your program...' }) => (
  <Card className="max-w-xl">
    <div className="text-center py-8">
      <Loader2 className="w-10 h-10 mx-auto text-orange-500 animate-spin" />
      <p className="mt-4 font-medium text-stone-900">{message}</p>
      <p className="text-sm text-stone-500 mt-1">Matching movements to your equipment, setting rep ranges and rest times...</p>
    </div>
  </Card>
);

// Shown whenever a client's equipment can't fill one or more slots. The app
// says so plainly and points them to Radu rather than inventing a bad exercise.
const GapNotice = ({holes}) => {
  if (!holes.length) return null;
  const list = holes.map(h => (PATTERN_LABEL[h] || h).toLowerCase());
  const joined = list.length === 1 ? list[0]
    : list.slice(0,-1).join(', ') + ' or ' + list[list.length-1];
  return (
    <div className="mt-5 bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3">
      <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-stone-700 leading-relaxed">
        Your equipment can't cover {joined}. The rest of the program is complete and you can
        start training on it. Message Radu in the ShredSmart community and he'll work out a
        solution for your setup.
      </p>
    </div>
  );
};

// =====================================================
// VOLUME TRACKER
// Weekly sets per muscle group, derived from the resolved program.
// Isolation pays a full set; a compound pays a full set to each primary
// muscle and half to each secondary, so totals land on halves.
// =====================================================
// Artwork. Two figures in one 900x648 canvas, 19 fillable regions.
// Each muscle comes from the artwork's base tone, falling back to a darker tone
// for the couple of groups drawn without one. Two source quirks are handled here
// rather than at render time: the front adductor is drawn with striation gaps so
// it is replaced by its solid outline, and the pack ships two differently-spelled
// tensor fasciae latae files, the front one duplicating gluteus medius exactly.
const BODY_VIEWBOX = '0 0 701 648';
const BODY_BASE = ['M 211.8,260.4 L 211.8,251.9 C 211.8,245.8 208.4,239.2 206.3,235.7 C 208.4,228.7 208.4,211.9 207.3,204.1 C 206.6,199.3 203.3,195.5 201.6,193 C 201.7,192.8 201.7,192.6 201.7,192.4 C 202.6,186.7 198.7,172.6 196.4,166.7 C 194.9,162.7 191.6,161.2 189,160 C 187.6,159.4 186.4,158.8 185.7,158 C 184,156 182.2,155.4 180.7,154.9 C 180.3,154.8 179.9,154.7 179.5,154.5 C 178.9,154.3 178.4,153.8 177.6,153.1 C 176.2,151.9 174.2,150 169.8,147.5 C 167.5,146.1 164.1,144.5 160.5,142.8 C 154.7,140 147.9,136.8 146.2,134.8 C 144.7,132.9 144.6,127.1 144.6,125.2 C 145.3,123.4 145.3,120.6 145.3,119 C 145.6,119.1 146,119.2 146.4,119.1 C 147.9,118.9 149.2,116.7 150.9,113.7 C 151.3,112.9 151.7,112.1 152.1,111.7 C 153.5,109.6 153.2,105.3 152.1,102 C 151.8,101 151.3,100.5 150.6,100.4 C 149.7,100.2 148.6,100.9 147.8,101.6 C 148,97.5 147.9,86.1 143.2,80.4 C 139.2,75.6 131,74.3 128,74.1 L 126.8,74.1 C 123.7,74.3 115.6,75.6 111.5,80.4 C 106.8,86.1 106.8,97.5 106.9,101.6 C 106.1,100.9 105.1,100.2 104.1,100.4 C 103.4,100.5 102.9,101 102.6,102 C 101.5,105.3 101.2,109.6 102.6,111.7 C 103,112.1 103.4,112.9 103.9,113.7 C 105.5,116.7 106.9,118.9 108.3,119.1 C 108.7,119.2 109.1,119.1 109.4,119 C 109.4,120.8 109.5,124 110.4,125.7 C 110.4,125.7 110.4,125.8 110.4,125.8 C 110.4,127.1 110.1,132.9 108.5,134.8 C 106.9,136.8 100.3,140 94.4,142.8 C 90.8,144.5 87.5,146.1 85.1,147.5 C 80.7,150 78.7,151.9 77.3,153.1 C 76.6,153.8 76,154.3 75.4,154.5 C 75.1,154.7 74.7,154.8 74.3,154.9 C 72.7,155.4 71,156 69.2,158 C 68.5,158.8 67.3,159.4 65.9,160 C 63.3,161.2 60.1,162.7 58.5,166.7 C 56.2,172.6 52.3,186.7 53.2,192.4 C 53.3,192.8 53.3,193.2 53.4,193.6 C 51.7,196.1 48.8,199.6 48.1,204.3 C 47,212 46.8,228.2 48.9,235.3 C 46.8,238.6 43.1,245.5 43.1,251.9 L 43.1,260.4 C 42.5,261.3 39.4,266.9 40.1,277.7 C 40.3,281.9 40.8,285.7 41.3,289.8 C 42.2,297 45.1,305.1 44.8,314.8 C 44.3,329.5 44.5,343.6 45.1,346.3 C 45.6,348.8 50.2,360.9 50.4,361.4 L 50.6,361.8 L 51,361.7 C 51,361.7 53.8,360.9 54,357.3 L 55.5,359 L 55.9,358.4 C 56,358.3 57.3,356.5 57.6,354.2 C 58.5,352.8 60.2,349.3 58.2,346.3 C 55.9,342.8 52.2,335.7 52.2,335.7 L 52.2,335.7 C 52.2,335.4 52.2,335.2 52.1,335.1 C 52.7,330.9 52.1,329.3 53.7,328.8 C 53.8,328.7 53.9,328.7 54,328.8 C 55.1,329.5 55.4,331.5 55.7,333.5 C 55.9,335.5 56.2,337.5 57.2,339 C 58.3,340.9 60.1,343.2 62.2,341.5 C 63.6,340.4 62.4,332.5 62,330.2 C 61.6,327.3 61.6,326.5 60.5,321.9 C 59.8,319 59.3,317.5 59.1,316.1 C 59,315 59.3,310.4 59.7,307 C 60.2,303.1 62.6,296.7 65.2,290 C 68.1,282.3 71.1,274.3 71.3,269.7 C 71.6,262.5 70.7,258.9 70.3,257.9 C 70.9,257.2 72.6,254.9 73.1,252 C 73.6,248.7 73.4,242.8 73.4,242.7 C 73.4,242.6 75.2,232.5 78.1,227.9 C 80.3,224.3 83.6,217.5 85,213.8 C 85.5,217.4 86,220.6 86.6,222.3 C 87.3,224.5 88.3,226.9 89.1,229.2 C 90.4,232.5 91.6,235.6 91.9,237.3 C 92.3,239.6 92,256.6 91.9,262.2 C 91.9,263.4 91.9,264.2 91.9,264.4 C 91.9,264.4 91.9,264.4 91.9,264.4 C 91.8,264.5 91.7,264.7 91.7,264.9 C 91.4,265.3 91.1,265.9 90.8,266.4 C 89,269.2 86,273.8 86.6,278.4 C 87.2,283.5 88,285.6 88.3,286.3 C 87.7,288.1 83.5,302.1 84.1,312.2 C 84.3,315.7 83,321.2 81.2,328.1 C 79,337.1 74.7,357.7 73.7,370.5 C 72.3,389.6 77.8,411.3 79.3,423.1 C 79.6,425.6 79.8,427.3 79.9,427.8 C 79.9,429 79.8,429.9 79.7,430.9 C 79.5,432.2 79.3,433.7 79.5,436.6 C 79.5,436.9 79.6,437.2 79.7,437.6 C 78.9,439.2 72.4,454.1 72.3,463.8 C 72.2,468.5 73.7,479.1 75.3,490.2 C 76.8,500.3 78.2,510.7 78.6,517.2 L 78.6,517.3 C 78.6,517.9 78.7,518.4 78.7,518.9 C 78.8,522.3 78.4,529.2 78.2,529.8 C 77.7,531.4 77.2,532.9 77.3,535.2 C 77.1,535.4 77,535.5 76.8,535.6 C 74.9,537.3 74.2,539.5 73.4,541.6 C 73.2,542.3 72.9,542.9 72.7,543.6 C 71.6,546 62.5,553.5 61.3,554.3 C 60.3,554.9 57.8,558.5 57.8,558.5 C 56.9,559.5 57.2,561.2 57.3,562.3 C 57.4,562.5 57.4,562.6 57.4,562.8 C 57.5,563.4 57.7,563.8 57.8,564.1 C 57.9,564.4 58,564.6 58,564.8 C 58.1,565.2 58,565.6 57.9,566 C 57.9,566.3 57.8,566.7 57.8,567 C 57.8,567.6 57.9,569.1 58.5,569.6 C 58.8,569.8 59.1,570 59.6,570.1 C 59.5,570.3 59.5,570.5 59.4,570.7 C 59,571.8 59.8,572.9 60.4,573.3 C 60.8,573.6 61.5,573.7 62,573.7 C 62,573.7 62,573.8 62,573.9 C 62.1,574.6 62.3,575.7 63.3,576.1 C 64.3,576.6 64.8,576.5 65.4,576.2 C 66.5,577.8 68.8,578.7 70.9,578.5 C 71.2,578.5 71.5,578.5 71.7,578.4 C 73.9,577.9 76.5,576 77.5,573.5 C 78.3,571.6 79.5,570.9 80.5,570.5 C 84.8,569.1 87.1,564.4 87.7,560 C 88.3,556.1 90.8,551.8 91.4,551 C 94.4,549.7 96.2,548.1 97.7,545.9 C 99.3,543.5 99.3,542 98.9,540.1 C 98.5,538.3 97.3,529.5 96.9,528.2 C 96.6,527 96.4,525.8 96.1,524.3 C 95.3,519.7 101,496 102.6,491.4 C 103.3,489.6 104.2,487.7 105.3,485.4 C 107.1,481.6 109.3,476.9 111.1,470.9 C 113.9,461.9 109.6,441.8 109,439.5 C 110.6,436.7 112,433.8 113.2,430.9 C 114.2,428.5 115.1,426.1 115.6,423.6 C 116.3,419.9 116.9,412.9 117.5,404.8 C 118.1,397.6 118.8,389.5 119.7,383 C 120.7,375 122.8,366 124.5,358.7 C 125.7,353.7 126.7,349.5 127,346.9 C 127.6,342 127,337.2 126.7,335.1 C 127,335.1 128.2,335.2 128.4,335.1 C 128.1,337.2 127.5,342 128.1,346.9 C 128.4,349.5 129.4,353.8 130.6,358.7 C 132.3,366 134.4,375 135.4,383 C 136.3,389.5 137,397.6 137.6,404.8 C 138.2,412.9 138.8,419.9 139.5,423.6 C 140,426.1 140.9,428.6 141.9,430.9 C 143.1,433.8 144.5,436.7 146.1,439.5 C 145.5,441.9 141.2,461.9 144,470.9 C 145.8,476.9 148,481.6 149.8,485.4 C 150.9,487.7 151.8,489.6 152.5,491.4 C 154.1,496 159.8,519.7 159,524.3 C 158.7,525.8 158.5,527 158.2,528.2 C 157.8,529.5 156.6,538.3 156.2,540.1 C 155.7,542.1 155.8,543.6 157.4,545.9 C 158.9,548.1 160.7,549.7 163.7,551 C 164.3,551.8 166.8,556.1 167.4,560 C 168,564.4 170.3,569.1 174.6,570.5 C 175.6,570.9 176.8,571.6 177.6,573.5 C 178.6,576 181.2,577.9 183.4,578.4 C 183.6,578.5 183.9,578.5 184.2,578.5 C 186.2,578.8 188.6,577.8 189.7,576.2 C 190.3,576.5 190.8,576.6 191.8,576.1 C 192.8,575.6 193.1,574.4 193.1,573.7 C 193.6,573.7 194.2,573.7 194.7,573.4 C 195.3,572.9 196.1,571.8 195.7,570.7 C 195.6,570.5 195.6,570.3 195.5,570.2 L 195.5,570.2 C 195.5,570.2 195.5,570.2 195.5,570.1 C 196,570.1 196.3,569.9 196.6,569.6 C 197.2,569.1 197.3,567.6 197.3,567 C 197.2,566.7 197.2,566.3 197.2,566 C 197.1,565.6 197,565.2 197.1,564.9 C 197.1,564.6 197.1,564.4 197.3,564.1 C 197.4,563.8 197.6,563.4 197.7,562.8 C 197.7,562.7 197.7,562.5 197.8,562.3 C 198,561.2 198.2,559.6 197.3,558.6 C 197.3,558.6 194.8,554.9 193.8,554.3 C 192.6,553.5 183.5,546 182.4,543.6 C 182.2,543 181.9,542.3 181.7,541.6 C 180.9,539.5 180.2,537.3 178.3,535.7 C 178.1,535.5 178,535.4 177.8,535.3 C 177.9,532.9 177.4,531.4 176.9,529.9 C 176.7,529.2 176.3,522.3 176.4,518.9 C 176.4,518.4 176.5,517.9 176.5,517.4 C 176.5,517.3 176.5,517.2 176.5,517.2 L 176.5,517.2 C 176.9,510.7 178.3,500.3 179.8,490.2 C 181.4,479.1 182.9,468.6 182.8,463.8 C 182.7,454.2 176.3,439.4 175.5,437.6 C 175.5,437.2 175.6,436.8 175.6,436.5 C 175.8,433.6 175.6,432.1 175.4,430.8 C 175.3,429.8 175.2,428.9 175.3,427.7 C 175.3,427.2 175.5,425.5 175.8,423 C 177.4,411.2 182.8,389.4 181.4,370.4 C 180.5,357.6 176.2,336.9 173.9,328 C 172.2,321.1 170.8,315.6 171,312 C 171.7,302 167.4,288 166.8,286.1 C 167.1,285.5 167.9,283.4 168.5,278.3 C 169.1,273.7 166.2,269 164.4,266.3 C 163.9,265.4 163.3,264.5 163.3,264.3 C 163.3,264.1 163.3,263.3 163.2,262.1 C 163.1,256.5 162.8,239.5 163.3,237.1 C 163.6,235.5 164.8,232.4 166,229.1 C 166.9,226.8 167.8,224.4 168.5,222.2 C 169.1,220.5 169.6,217.5 170.1,214.1 C 170.1,214 170.1,214 170.1,214 C 171.5,217.6 174.7,224 176.7,227.6 C 180.3,234 181.6,244.5 181.8,251.8 C 181.9,254.8 183.9,257 184.5,257.7 C 184.2,258.7 183.2,262.3 183.5,269.5 C 183.7,274.1 186.8,282.1 189.7,289.8 C 192.2,296.5 194.6,302.9 195.1,306.8 C 195.5,309.6 195.8,311.4 195.8,312.8 C 195.9,314.1 195.8,315.5 195.7,316.8 C 195.6,318 195.1,319.5 194.5,322 C 193.3,326.6 193.3,327.4 192.9,330.3 C 192.6,332.6 191.4,340.4 192.7,341.6 C 194.8,343.3 196.6,340.9 197.8,339.1 C 198.8,337.5 199,335.5 199.3,333.6 C 199.6,331.5 199.8,329.6 201,328.8 C 201,328.8 201.1,328.8 201.2,328.8 C 202.8,329.4 202.3,330.9 202.8,335.1 C 202.8,335.3 202.8,335.5 202.7,335.7 L 202.7,335.7 C 202.7,335.8 199,342.9 196.8,346.3 C 194.8,349.3 196.5,352.9 197.3,354.3 C 197.7,356.5 199,358.4 199,358.5 L 199.4,359 L 200.9,357.3 C 201.1,361 203.9,361.8 203.9,361.8 L 204.4,361.9 L 204.6,361.4 C 204.8,360.9 209.3,348.8 209.9,346.3 C 210.5,343.6 210.7,329.6 210.2,314.9 C 209.8,305.2 212.8,297 213.6,289.8 C 214.1,285.8 214.6,281.9 214.8,277.8 C 215.5,266.9 212.4,261.4 211.8,260.4','M 658,263.9 L 658,255.1 C 658,246.6 651.6,237.3 650.7,236 C 650.6,234.4 649.9,221.9 648.7,216 C 647.5,210.5 645.5,205.1 645.1,204.1 C 645.4,203.1 646.8,198.9 647.6,193.8 C 648.5,187.9 644.5,173.4 642.1,167.2 C 640.5,163.2 637.2,161.6 634.5,160.4 C 633,159.7 631.8,159.2 631.1,158.3 C 629.3,156.2 627.5,155.6 625.9,155.1 C 625.4,155 625,154.9 624.7,154.7 C 624,154.5 623.5,154 622.7,153.2 C 621.3,152 619.2,150.1 614.7,147.5 C 612.1,145.9 608.2,144.2 604.2,142.3 C 598.1,139.5 591.1,136.3 589.5,134.3 C 588.8,133.5 587.9,130.8 587,127.9 C 587.5,127 588.9,124.3 589,123.9 C 589.5,122 589.6,119.5 589.6,118 C 589.9,118.2 590.2,118.3 590.7,118.2 C 592.2,118 593.6,115.7 595.3,112.6 C 595.7,111.8 596.2,111 596.5,110.5 C 598,108.4 597.7,103.9 596.6,100.5 C 596.3,99.6 595.8,99 595,98.9 C 594,98.7 592.9,99.4 592.1,100.2 C 592.3,96 592.2,84.1 587.4,78.3 C 583.2,73.3 574.8,72 571.7,71.7 L 570.4,71.7 C 567.2,72 558.9,73.3 554.7,78.3 C 549.9,84.1 549.8,95.9 549.9,100.2 C 549.2,99.4 548.1,98.7 547.1,98.9 C 546.3,99 545.8,99.6 545.5,100.5 C 544.4,103.9 544.1,108.4 545.6,110.5 C 545.9,111 546.3,111.8 546.8,112.6 C 548.5,115.7 549.9,118 551.4,118.2 C 551.8,118.3 552.2,118.2 552.5,118 C 552.5,119.5 552.6,122 553.1,123.9 C 553.2,124.3 554.5,126.9 555,127.9 C 554.2,130.8 553.2,133.5 552.5,134.3 C 550.9,136.3 544,139.5 537.9,142.3 C 533.8,144.2 529.9,146 527.4,147.5 C 522.9,150.1 520.8,152 519.4,153.2 C 518.5,154 518,154.5 517.4,154.7 C 517,154.9 516.6,155 516.2,155.1 C 514.6,155.6 512.8,156.2 511,158.3 C 510.3,159.2 509,159.7 507.6,160.4 C 504.9,161.6 501.6,163.2 500,167.2 C 497.5,173.4 493.5,187.9 494.5,193.8 C 495.3,198.9 496.6,203.1 497,204.1 C 496.5,205.1 494.5,210.5 493.4,216 C 492.2,221.9 491.4,234.4 491.4,236 C 490.5,237.3 484.1,246.6 484.1,255.1 L 484.1,263.9 C 483.4,264.9 480.3,270.6 481,281.8 C 481.2,286.1 481.7,290 482.2,294.2 C 483.1,301.6 484.9,309.3 484.6,319.3 C 484.1,334.5 484.2,347.5 486.1,353.3 C 486.9,355.8 491.3,368.2 491.5,368.8 C 491.5,368.8 491.7,369.3 492.2,369.2 C 492.3,369.2 495,368.4 495.3,364.7 L 496.5,365.9 C 496.7,366.1 497,366.1 497.2,365.9 L 497.3,365.8 C 497.3,365.7 498.6,363.8 499,361.5 C 499.9,360.3 501.5,357 499.5,354 C 498.7,352.7 495.7,349.6 495,348.9 C 494.9,348.3 494.7,346.3 494.2,344.2 C 493.7,341.6 494,339.6 494.6,338.3 C 494.8,338 494.9,337.7 495.1,337.3 C 495.6,336.7 496.1,336.3 496.6,336.1 C 496.7,336.1 496.8,336.1 496.9,336.1 C 498.1,336.9 498.3,338.9 498.6,341 C 498.9,343 499.3,345.1 500.2,346.7 C 501.4,348.8 504.7,349.5 505.1,345.6 C 505.4,342.9 505.4,339.5 505.4,338 L 505.3,336.6 C 505,331 504.8,328.2 501.8,323.3 C 500.5,321.2 500.5,320 501.3,311.7 C 501.7,307.7 504.3,301.1 506.9,294.2 C 509.9,286.2 513,278 513.2,273.2 C 513.5,265.8 512.6,262.2 512.2,261.1 C 512.8,260.4 514.6,258.1 515,255.1 C 515.6,251.6 515.4,245.6 515.4,245.4 C 515.4,245.3 517.2,234.9 520.2,230.1 C 522.5,226.6 525.5,220.3 526.9,216.6 C 527.7,220.3 528.5,223.3 528.9,224.7 C 529.7,226.9 530.6,229.4 531.5,231.8 C 532.8,235.2 534.1,238.4 534.4,240.1 C 534.7,241.8 534.8,250.2 534.6,265 C 534.6,265.8 534.6,266.3 534.6,266.5 C 534.6,266.8 534,267.9 533.4,268.9 C 531.5,272.2 528.3,277.8 528.9,282.5 C 529.6,287.8 530.4,290 530.7,290.7 C 530.1,292.6 525.7,307 526.3,317.4 C 526.6,321 525.1,326.6 523.3,333.8 C 521,343 518.1,354.5 517.1,367.8 C 515.7,387.4 519.8,419.6 521.4,431.8 C 521.7,434.4 521.9,436.1 522,436.6 C 522,437.9 521.9,438.7 521.8,439.8 C 521.6,441.2 521.4,442.7 521.6,445.7 C 521.6,446.4 521.8,447.2 522,448.1 C 520.9,450.9 519.9,453.7 519.1,456.3 C 511.8,472.7 515,490 518.2,506.8 C 518.8,510.4 519.5,514.2 520.1,517.9 L 520.2,518.7 C 521,525.3 521.7,532.2 520.1,538.5 C 519.2,541.6 518.4,543.5 517.7,544.6 C 517.7,544.6 517.7,544.6 517.7,544.6 C 517.6,544.7 517.6,544.8 517.6,544.8 C 517.5,545.1 517.3,545.3 517.2,545.5 C 517.1,545.7 517,545.8 516.9,546 C 516.3,547.2 516.2,548.5 516.5,549.9 C 516.3,550.4 514.9,554 511.2,556.1 C 507.8,558 504.7,559.3 503.6,559.9 C 501.1,559.4 498,560.2 497.4,560.9 C 497,561.4 496.5,562.1 496.5,564.1 C 496.5,565.9 498.7,566.8 499.7,567 C 499.7,567.7 499.9,568.9 500.8,570.3 C 502.1,572.3 510.1,574.9 513.5,575.9 C 514.7,576.2 516.9,577.8 518.9,579.1 C 520.8,580.4 522.5,581.6 523.6,582 C 524.7,582.4 527.1,582.8 529.8,582.8 C 533.1,582.8 537.1,582.2 540.1,580.3 C 545.9,576.7 541.9,561.8 541.7,561.2 C 541.5,560.4 541.3,559.6 541.1,558.8 C 540.4,556.1 539.5,553 538.7,550.5 C 538.8,549.6 539.2,548.6 539.8,547.6 C 540.3,546.4 540.9,545.3 540.9,544 L 540.9,543.9 C 535.7,525.2 543.4,507.6 550.9,490.6 L 551.8,488.4 C 552.2,486.9 552.7,485.5 553.2,484.1 C 554.1,481.1 555.1,478.1 555.1,475.1 C 554.7,470.9 553.5,466.8 552.2,462.5 C 551.4,460 550.4,456.2 549.5,452.7 C 553.9,446 557.8,437.4 558.8,432.3 C 559.5,428.4 560.1,421.2 560.8,412.8 C 561.4,405.5 562.1,397.1 563,390.4 C 564,382.1 566.2,372.8 568,365.3 C 569.2,360.2 570.2,355.8 570.6,353.1 C 571.3,347.2 570.2,340.3 570,338.8 C 570.6,336.7 570.9,334.3 571,331.9 C 571.1,334.3 571.4,336.7 572,338.8 C 571.8,340.3 570.7,347.2 571.5,353.1 C 571.8,355.8 572.8,360.2 574,365.3 C 575.8,372.8 578,382.1 579,390.4 C 579.9,397.1 580.6,405.4 581.2,412.8 C 581.9,421.2 582.5,428.4 583.2,432.3 C 584.2,437.4 588.1,446 592.5,452.7 C 591.6,456.3 590.5,460.2 589.8,462.5 C 588.5,466.8 587.3,470.9 586.9,475.1 C 586.9,478.1 587.9,481.1 588.8,484.1 C 589.3,485.5 589.8,487 590.2,488.4 L 591.1,490.6 C 598.6,507.6 606.3,525.2 601.1,543.9 L 601.1,544 C 601.1,545.3 601.7,546.4 602.2,547.6 C 602.8,548.6 603.2,549.6 603.3,550.5 C 602.5,553 601.6,556.1 600.9,558.8 C 600.7,559.6 600.5,560.4 600.3,561.2 C 600.1,561.8 596.2,576.7 601.9,580.3 C 604.9,582.2 608.9,582.8 612.2,582.8 C 615,582.8 617.3,582.4 618.4,582 C 619.5,581.6 621.2,580.4 623.1,579.1 C 625.1,577.8 627.3,576.2 628.5,575.9 C 631.9,574.9 639.9,572.3 641.2,570.3 C 642.1,568.9 642.3,567.7 642.3,567 C 643.3,566.8 645.5,565.9 645.5,564.1 C 645.5,562.1 645,561.4 644.6,560.9 C 644,560.2 640.9,559.4 638.4,559.9 C 637.3,559.3 634.2,558 630.8,556.1 C 627.1,554 625.7,550.4 625.5,549.9 C 625.7,548.5 625.7,547.2 625.1,546 C 625,545.8 624.9,545.7 624.8,545.5 C 624.7,545.3 624.5,545.1 624.4,544.8 C 624.4,544.8 624.4,544.7 624.3,544.6 C 624.3,544.6 624.3,544.6 624.3,544.6 C 623.6,543.5 622.8,541.6 621.9,538.5 C 620.3,532.2 621,525.3 621.8,518.7 L 621.9,517.9 C 622.5,514.2 623.2,510.4 623.8,506.8 C 627,490 630.2,472.7 622.9,456.3 C 622.1,453.7 621.1,450.9 620,448.1 C 620.2,447.2 620.4,446.4 620.4,445.7 C 620.6,442.7 620.4,441.2 620.3,439.8 C 620.1,438.8 620,437.9 620.1,436.6 C 620.1,436.1 620.3,434.3 620.7,431.8 C 622.2,419.6 626.3,387.4 624.9,367.8 C 623.9,354.5 621,343 618.7,333.8 C 616.9,326.6 615.5,321 615.7,317.4 C 616.4,307 612,292.6 611.4,290.7 C 611.7,290 612.5,287.8 613.1,282.5 C 613.7,277.8 610.5,272.2 608.6,268.9 C 608.1,267.9 607.4,266.8 607.4,266.5 C 607.4,266.3 607.4,265.8 607.4,265 C 607.3,250.2 607.4,241.8 607.7,240.1 C 608,238.4 609.2,235.2 610.5,231.8 C 611.4,229.4 612.4,226.9 613.1,224.7 C 613.6,223.3 614.3,220.3 615.1,216.6 C 616.6,220.4 619.6,226.6 621.8,230.1 C 624.8,234.9 626.6,245.3 626.6,245.4 C 626.6,245.6 626.4,251.6 627,255.1 C 627.5,258.1 629.2,260.4 629.8,261.1 C 629.5,262.2 628.5,265.8 628.8,273.2 C 629,278 632.1,286.2 635.1,294.2 C 637.7,301.1 640.3,307.7 640.7,311.7 C 641.5,320 641.5,321.2 640.2,323.3 C 637.2,328.2 637,331 636.7,336.6 L 636.6,338 C 636.6,339.5 636.6,342.9 636.9,345.6 C 637.4,349.5 640.7,348.8 641.8,346.7 C 642.8,345.1 643.1,343 643.4,341 C 643.7,338.9 644,336.9 645.1,336.1 C 645.2,336.1 645.3,336.1 645.4,336.1 C 645.9,336.3 646.4,336.7 646.9,337.3 C 647.1,337.7 647.3,338 647.4,338.3 C 648,339.6 648.3,341.6 647.8,344.2 C 647.3,346.3 647.1,348.3 647,348.9 C 646.3,349.6 643.3,352.7 642.5,354 C 640.5,357 642.2,360.3 643,361.5 C 643.4,363.8 644.7,365.7 644.8,365.8 L 644.8,365.9 C 645,366.1 645.3,366.1 645.5,365.9 L 646.7,364.7 C 647,368.4 649.8,369.2 649.8,369.2 C 650.3,369.3 650.5,368.8 650.5,368.8 C 650.7,368.2 655.1,355.8 655.9,353.3 C 657.8,347.5 658,334.5 657.4,319.3 C 657.1,309.3 658.9,301.6 659.8,294.2 C 660.3,290 660.8,286.1 661.1,281.8 C 661.8,270.6 658.6,264.9 658,263.9'];
const BODY_REGIONS = {
  CHEST: ['M 129.2,187.4 C 129.8,193 130.5,199.7 134.7,203.8 C 140.1,209.2 151.9,212.5 159,209.4 C 166.7,206.1 173,196.8 177.3,189.9 C 176.6,185.6 175.6,182 173.1,179 C 172.3,178.3 169,173.9 169,173.9 C 163.3,168.7 162.4,164.4 150.7,164.4 C 138.2,164.3 133.7,166.2 129.3,172.8 C 127.2,176.2 128.9,183.7 129.2,187.4','M 125.5,186.9 C 124.9,192.5 124.2,199.2 120,203.3 C 114.6,208.7 102.8,212 95.7,208.9 C 88,205.6 81.7,196.3 77.4,189.4 C 78.1,185.1 79.1,181.6 81.6,178.5 C 82.4,177.8 85.7,173.4 85.7,173.4 C 91.4,168.2 92.3,164 104,163.9 C 116.5,163.8 121,165.7 125.4,172.4 C 127.6,175.7 125.8,183.2 125.5,186.9'],
  FRONT_DELT: ['M 88.5,169.2 C 87.8,171.4 86.6,173.4 85,175.2 C 83.9,176.2 82.9,177.3 82,178.4 L 81.7,178.8 C 79.5,181.7 77.8,185.1 77.2,188.9 L 77.2,189 C 75.3,192.9 72.8,196.3 69.5,199.2 C 67.6,200.9 65.4,202.2 63.1,203.4 C 59.8,205 58.6,204.8 56.6,202.4 C 56.4,201.7 55,197.6 54.2,192.5 C 53.3,186.9 57.1,172.7 59.4,166.8 C 60.8,163.3 63.7,162 66.2,160.8 C 67.1,160.4 67.9,160 68.6,159.5 C 70.6,163.4 77.1,162.5 80.6,162.2 C 85.3,162 90.2,163.2 88.5,169.2','M 165.9,168.3 C 164.7,162.2 169.6,161.6 174.4,161.9 C 177.8,162.1 184.1,163.3 186.1,159.4 C 186.8,159.9 187.8,160.4 188.6,160.8 C 191.2,162 194.2,163.7 195.6,167.3 C 197.9,173.1 201.7,187 200.8,192.6 C 200,197.7 198.6,201.7 198.4,202.4 C 196.4,204.9 194.9,205 191.7,203.4 C 189.4,202.2 187.2,200.9 185.3,199.2 C 182,196.3 179.5,192.9 177.6,189 L 177.6,188.9 C 176.9,185.1 175.3,181.7 173,178.8 C 173,178.8 170.9,175.9 169.9,174.9 C 168.3,173.1 166.6,171.7 165.9,168.3'],
  SIDE_DELT: [],
  REAR_DELT: ['M 520.9,189.1 C 516,191.6 510.7,192.6 506,195.6 C 503.1,197.4 500.6,199.9 498.3,202.4 C 497.8,201 496.7,197.3 496,192.9 C 495.1,187.2 499,173.1 501.4,167.1 C 502.8,163.4 505.8,162.1 508.4,160.9 C 509.3,160.5 510.1,160.1 510.8,159.6 C 515.5,160.3 519.4,162.6 523.2,166.2 C 529.8,172.6 528.7,185 520.9,189.1','M 621.2,189.1 C 626.1,191.6 631.4,192.6 636.1,195.6 C 639,197.4 641.5,199.9 643.8,202.4 C 644.3,201 645.4,197.3 646.1,192.9 C 647,187.2 643.1,173.1 640.7,167.1 C 639.3,163.4 636.3,162.1 633.7,160.9 C 632.8,160.5 632,160.1 631.3,159.6 C 626.6,160.3 622.7,162.6 618.9,166.2 C 612.3,172.6 613.4,185 621.2,189.1'],
  TRICEPS: ['M 172,198.3 C 172,198.3 177,239.8 195.2,256.3 C 195.4,256.8 191.7,263.9 191.7,263.9 C 191.7,263.9 187.3,259 185.5,257.7 C 182.5,255.5 181.3,255.6 181.7,243.3 C 181.3,240.8 180.1,232.6 178.2,229.6 C 176.3,226.5 169.7,212.4 169.7,212.4 L 171,199.5 L 172,198.3','M 82.9,198.4 C 82.9,198.4 78,240.3 59.7,256.8 C 59.6,257.3 63,263.9 63,263.9 L 69.2,258.1 C 69.2,258.1 73.4,255.7 73.1,243.4 C 73.4,240.9 74.7,232.7 76.6,229.6 C 78.5,226.6 85.1,212.5 85.1,212.5 L 83.8,199.6 L 82.9,198.4','M 49.5,236 C 47.1,225.9 48,219.1 48.1,211.2 C 48.3,200.8 48.2,202.1 53.9,193.7 C 54.2,196.3 56.1,203 56.1,203 C 56.1,203 51.9,212.8 50.7,234 C 50.6,234.2 49.5,236 49.5,236','M 205.8,236.1 C 208.2,226 207.3,219.2 207.2,211.3 C 207,201 207.1,202.2 201.4,193.8 C 201.1,196.4 199.1,202.8 199.1,202.8 C 199.1,202.8 203.4,212.9 204.6,234.1 C 204.7,234.3 205.8,236.1 205.8,236.1','M 615.3,213.7 L 615.3,213.7 C 616.2,216.4 619.7,224.2 622.4,228.5 C 624.6,231.9 626.1,237.7 626.8,241.3 C 628.6,244.9 631.1,247.8 635.7,249.4 C 636.2,249.5 636.8,249.7 637.3,249.9 C 633.4,242.9 631.2,235.4 628.7,227.8 C 628.3,226.8 625,218.1 629.1,218.6 C 633,219 635.1,225.6 636.5,228.5 C 639.5,235.4 641.5,242.6 642.2,250.1 C 643.3,249.4 644,248.2 644.7,246.5 C 646.3,242.9 647.9,237.9 649.1,233.7 C 648.9,229.9 648.2,220.2 647.2,215.3 C 646,209.3 643.6,203.5 643.6,203.5 L 643.5,203.3 L 643.5,203.2 C 638.1,197.8 632.5,193.8 624.7,191.1 C 623.2,190.5 621.6,189.9 620.2,189.2 C 619.5,193.1 617.2,204.8 615.3,213.7','M 526.8,213.7 L 526.8,213.7 C 525.9,216.4 522.4,224.2 519.6,228.5 C 517.5,231.9 516,237.7 515.2,241.3 C 513.4,244.9 511,247.9 506.4,249.5 C 505.9,249.7 505.2,249.9 504.6,250 C 508.6,243.1 510.8,235.4 513.4,227.8 C 513.7,226.8 517.1,218.2 513,218.7 C 509.1,219.1 507,225.7 505.7,228.6 C 502.6,235.5 500.6,242.7 499.9,250.2 C 498.8,249.6 498,248.3 497.3,246.6 C 495.7,242.9 493.9,237.9 492.7,233.8 C 492.9,230 493.9,220.2 494.9,215.3 C 496.1,209.3 498.4,203.5 498.5,203.5 L 498.5,203.3 L 498.5,203.2 C 503.9,197.8 509.6,193.8 517.4,191.1 C 518.9,190.5 520.4,189.9 521.8,189.2 C 522.6,193.1 524.8,204.8 526.8,213.7'],
  BICEPS: ['M 59.9,255.9 L 59.7,256.3 C 55.6,249.2 50.5,242.5 51.2,233.9 C 51.2,233.8 51.2,233.7 51.2,233.6 C 51.2,233.5 51.2,233.4 51.2,233.3 L 51.2,233.2 L 51.2,233.2 C 51.3,230.7 52,219.6 53.1,214.4 C 54.1,209.4 55.9,204.6 56.4,203.2 C 57,203.9 57.6,204.8 58.2,205.5 L 58.2,205.6 C 51.2,221 53.7,239.8 59.7,255.4 L 59.9,255.9','M 194.9,255.8 C 201,240.1 203.7,220.4 196.6,205 L 196.7,205 C 197.3,204.2 197.8,203.4 198.4,202.7 C 198.9,204.1 200.8,209.5 201.9,214.4 C 202.9,219.6 203.6,230.7 203.8,233.2 L 203.8,233.3 L 203.7,233.3 C 203.8,233.5 203.8,233.6 203.8,233.7 C 203.8,233.8 203.8,233.8 203.8,234 C 204.5,242.5 199.4,249.2 195.3,256.3 L 194.9,256 L 194.9,255.8','M 172.2,197.8 C 171.7,210.6 181.1,233.5 181.8,236.4 C 181.8,236.4 184.2,242.3 185.8,245 C 188.2,249 191.2,252.5 194.7,255.7 C 200.6,240.1 203.1,220.2 195.9,205 C 188,202.6 181.4,197.2 177.6,189.7 C 176,192.3 174.1,195.4 172.2,197.8','M 82.7,197.9 C 83.3,210.7 73.9,233.6 73.1,236.5 C 73.1,236.5 70.7,242.4 69.1,245.1 C 66.8,249.1 63.8,252.8 60.3,256 C 54.4,240.4 51.9,220.3 59,205.1 C 67,202.7 73.5,197.3 77.3,189.9 C 78.9,192.5 80.8,195.5 82.7,197.9'],
  FOREARMS: ['M 196.3,317.6 C 204.2,307.5 211,296.6 213.1,283.9 L 213.2,283.8 C 213.4,281.9 213.8,279.9 213.9,277.9 C 214.5,268.9 212.1,263.2 211.2,261.4 C 210.1,269 206.9,276.4 203.8,283.4 C 199.7,292.7 197.2,302.1 196.5,312 C 196.5,313.6 196.5,314.9 196.3,316.2 L 196.3,316.2 L 196.3,316.2 C 196.3,316.7 196.3,317.1 196.3,317.6','M 58.5,317.6 C 50.5,307.5 43.7,296.6 41.6,283.9 L 41.6,283.8 C 41.4,281.9 41.2,279.9 41.1,277.9 C 40.6,269 42.6,263.3 43.6,261.5 C 44.6,269.1 47.8,276.4 50.9,283.4 C 55,292.7 57.6,302.1 58.3,312 C 58.2,313.6 58.3,314.9 58.5,316.2 L 58.5,316.2 L 58.5,316.2 C 58.5,316.7 58.5,317.1 58.5,317.6','M 70.6,268.9 C 70.9,262.1 69.7,259 69.4,258 C 67.2,259.7 65.2,261.6 63.4,263.7 C 63.7,264.6 63.8,266.3 64,267.2 C 65.8,275.8 64.9,284.2 63.1,292.5 C 63.4,291.7 63.8,290.8 64.1,290 C 67,282.3 70.4,274.1 70.5,269.7 L 70.6,268.9','M 184,268.7 C 183.7,261.9 185.1,258.8 185.5,257.8 C 187.7,259.4 189.9,261.5 191.6,263.6 C 191.3,264.5 190.9,265.8 190.7,266.7 C 188.9,275.3 190.1,284.3 191.8,292.7 C 191.5,291.8 190.8,290.8 190.5,289.9 C 187.6,282.3 184.2,274 184,269.6 L 184,268.7','M 193.4,296.7 L 193.4,296.7 C 194.7,300.6 195.8,304 196.1,306.5 C 196.1,306.9 196.2,307.3 196.2,307.7 C 196.9,301.5 198.6,295.5 200.7,289.6 C 204.2,279.8 209.7,270.6 210.9,260.2 L 210.9,251.6 C 210.9,244.7 206.1,237.2 204.3,234.6 C 204.6,244.1 197.8,251.6 193.7,259.9 C 187.8,271.4 190.3,284.6 193.4,296.7','M 58.5,308.6 C 57.8,302.4 56.4,295.9 54.2,289.9 C 50.7,280.2 45.3,271.3 44.1,260.9 L 44.1,252.2 C 44.1,245.4 48.8,237 50.6,234.4 C 50.3,243.9 57.4,251.5 61.5,259.8 C 67.4,271.2 64.7,285.3 61.6,297.4 L 58.5,308.6','M 649.5,234.9 C 649.5,234.9 658.6,244.7 657,263.1 C 655.7,261.5 650.3,256.3 648.7,254.3 C 647,252.4 645.4,248.5 645.1,247.1 C 645.7,245.6 649.3,236.6 649.5,234.9','M 492.8,235.4 C 492.8,235.4 483.6,245.2 485.2,263.6 C 486.5,262.1 491.9,256.8 493.5,254.8 C 495.2,252.9 496.8,249 497.2,247.7 C 496.5,246.1 492.9,237.1 492.8,235.4','M 499.6,251.6 C 497.8,260.9 493.2,268.8 489.2,277.4 C 486.2,283.7 485,291.5 484.5,298.4 C 484.3,296.9 484,294.3 483.8,292.8 C 483.3,288.7 482.8,284.8 482.5,280.6 C 481.9,269.7 485.1,264.1 485.5,263.4 L 485.5,263.3 C 489.4,258.1 495.6,254.3 497.2,247.9 C 497.5,248.6 497.9,249.3 498.2,250 C 498.6,250.9 499.1,251.4 499.6,251.6','M 642.5,251.6 C 644.3,260.9 648.9,268.8 652.9,277.4 C 655.9,283.7 657.1,291.5 657.6,298.4 C 657.8,296.9 658.1,294.3 658.3,292.8 C 658.8,288.7 659.3,284.8 659.5,280.6 C 660.2,269.7 657,264.1 656.6,263.4 L 656.5,263.3 C 652.6,258.1 646.5,254.3 644.8,247.9 C 644.5,248.6 644.2,249.3 643.9,250 C 643.5,250.9 643,251.4 642.5,251.6','M 503.4,273.2 C 500,281 498,289.6 497.6,298.1 C 496.3,302.6 494.4,308.1 493.5,312.5 C 493.1,314.6 492.9,316.7 492.5,318.8 C 491.8,322.1 487.8,324.2 487.3,319.2 C 486.2,307.7 487,294.4 487.8,283 L 487.8,283 C 488.7,280.3 489.8,277.6 491.1,274.9 C 493.9,269.2 496.7,263.9 498.6,258 C 498.7,263.5 500.3,268.6 503.4,273.2','M 638.7,273.2 C 642.1,281 644.1,289.6 644.5,298.1 C 645.7,302.6 647.7,308.1 648.5,312.5 C 648.9,314.6 649.2,316.7 649.6,318.8 C 650.3,322.1 654.3,324.2 654.8,319.2 C 655.8,307.7 655,294.4 654.2,283 L 654.2,283 C 653.3,280.3 652.3,277.6 651,274.9 C 648.2,269.2 645.4,263.9 643.5,258 C 643.4,263.5 641.8,268.6 638.7,273.2'],
  LATS: ['M 574.7,236.9 C 575.3,245.2 577,253.5 579.1,261.6 C 580,265 581.1,268.4 582,271.8 C 582.7,274.2 583.4,277.1 585.5,278.7 C 588.5,281 589.9,276.6 590.4,274.2 C 591.6,267.4 595.3,260.4 598.3,254.2 C 601.3,248 604.2,241.9 607.4,235.8 L 607.5,235.6 C 608,234.1 608.6,232.4 609.3,230.5 C 610.2,228.1 611.1,225.7 611.9,223.5 C 612.8,220.6 614.9,210.6 616.7,201.9 C 612.6,206.6 601.2,204.5 596.4,202.9 C 595.5,205.9 594.2,208.8 592.4,211.8 C 587.6,220.1 581.8,228.4 575.8,235.9 C 575.4,236.3 575.1,236.7 574.7,236.9','M 567.3,236.9 C 566.7,245.2 565,253.6 562.9,261.6 C 562.1,265.1 561,268.4 560,271.9 C 559.4,274.2 558.7,277.1 556.6,278.7 C 553.5,281 552.1,276.6 551.7,274.2 C 550.5,267.4 546.7,260.4 543.7,254.2 C 540.8,248 537.8,241.9 534.6,235.8 L 534.6,235.6 C 534,234.1 533.4,232.4 532.7,230.5 C 531.8,228.2 530.9,225.7 530.2,223.5 C 529.2,220.6 527.1,210.6 525.4,201.9 C 529.5,206.6 540.8,204.5 545.7,202.9 C 546.5,205.9 547.9,208.8 549.6,211.8 C 554.5,220.1 560.2,228.4 566.3,235.9 C 566.6,236.3 567,236.7 567.3,236.9'],
  UPPER_BACK: ['M 596.5,202.2 C 598.3,202.8 601,203.5 603.9,203.8 C 602.1,199.8 599.9,196 597.4,192.3 C 597.7,195.8 597.4,199.1 596.5,202.2','M 545.5,202.2 C 543.7,202.8 541,203.5 538.2,203.8 C 540,199.8 542.1,196 544.7,192.3 C 544.3,195.8 544.6,199.1 545.5,202.2','M 596.5,187.6 C 596.8,188.8 597,189.9 597.2,191 L 597.3,191.1 C 598.1,192.2 598.8,193.2 599.5,194.3 C 605.5,192.3 611,189.1 615,184.2 C 614.8,183.7 614.6,183.3 614.5,182.8 C 613.7,180.2 613.4,177.7 613.6,175.4 L 613.6,175.3 C 610.1,171.7 606.1,168.9 601.6,166.8 C 600.5,167 599.4,167.1 598.3,167.4 C 589.9,169.6 595.1,182.1 596.5,187.6','M 545.5,187.5 C 545.2,188.7 545,189.8 544.8,190.9 L 544.7,191 C 543.9,192 543.2,193.1 542.5,194.2 C 536.5,192.2 531.1,188.9 527,184 C 527.2,183.6 527.4,183.2 527.5,182.7 C 528.4,180.1 528.6,177.6 528.4,175.2 L 528.4,175.2 C 531.9,171.6 535.9,168.7 540.5,166.7 C 541.5,166.8 542.6,167 543.7,167.3 C 552.1,169.4 546.9,181.9 545.5,187.5','M 599.9,194.9 C 601.7,197.8 603.3,200.8 604.6,203.9 L 604.6,204 C 609.8,204.5 615.4,203.9 617,200 L 617.1,199.9 C 618.1,194.9 618.9,190.5 619.2,188.7 C 617.6,187.7 616.3,186.4 615.3,184.8 C 611.3,189.6 605.9,192.9 599.9,194.9','M 542.1,194.9 C 540.3,197.8 538.8,200.8 537.4,203.9 L 537.4,204 C 532.2,204.5 526.6,203.9 525,200 L 525,199.9 C 524,194.9 523.1,190.5 522.8,188.7 C 524.4,187.7 525.8,186.4 526.7,184.8 C 530.8,189.6 536.2,192.9 542.1,194.9'],
  TRAPS: ['M 142.7,138.3 L 142.7,138.3 C 147,142.2 149.1,148.3 152.2,153.1 C 158.5,162.9 170.1,156.6 179,155.2 C 178.5,154.9 177.5,154.2 176.9,153.7 C 175.6,152.5 173.6,150.7 169.4,148.2 C 167,146.8 163.3,145 159.8,143.3 C 153.5,140.3 147.5,137.4 145.7,135.2 C 145,134.3 144.6,132.3 144.3,130.7 C 144.2,130.6 143.9,130.6 143.9,130.5 C 143.6,132.1 143.2,135.7 142.7,138.3','M 112.1,137.8 C 111.6,135.2 111.1,132.5 110.9,130.9 C 110.6,132.5 109.6,134.8 108.8,135.7 C 107,137.9 100.9,140.5 94.6,143.5 C 91.1,145.2 87.7,146.8 85.4,148.2 C 81.1,150.7 78.1,152.8 76.8,154 C 76.2,154.5 75.7,155 75.2,155.3 C 84.1,156.7 96.1,163.2 102.3,153.4 C 105.4,148.5 107.8,142.2 112.2,138.3 L 112.1,137.8','M 569.8,129.7 C 569.7,135.6 569.3,140 565.7,144.9 C 562.1,149.9 559.6,152.9 553.7,155.3 C 548.1,157.6 524.1,162.9 518.7,155 C 519.2,154.6 519.7,154.2 520.4,153.6 C 521.7,152.4 523.8,150.5 528.1,148 C 530.7,146.5 534.5,144.7 538.5,142.9 C 544.9,140 551.6,136.9 553.4,134.8 C 557.7,131.3 560.5,126.1 562.9,121.1 C 563.4,120 563.9,118.9 564.4,117.9 C 565,116.7 566,115.5 567.2,115 C 568.4,114.5 569.6,115.5 569.7,116.7 C 569.8,117.7 569.9,118.7 569.9,119.7 C 570,123 569.9,126.4 569.8,129.7','M 572.3,129.7 C 572.4,135.6 572.8,140 576.4,144.9 C 580,149.9 582.5,152.9 588.4,155.3 C 593.9,157.6 617.9,162.9 623.4,155 C 622.8,154.6 622.3,154.2 621.7,153.6 C 620.3,152.4 618.3,150.5 613.9,148 C 611.4,146.5 607.6,144.7 603.5,142.9 C 597.1,140 590.5,136.9 588.6,134.8 C 584.3,131.3 581.6,126.1 579.2,121.1 C 578.7,120 578.2,118.9 577.7,117.9 C 577.1,116.7 576.1,115.5 574.8,115 C 573.7,114.5 572.5,115.5 572.4,116.7 C 572.2,117.7 572.1,118.7 572.1,119.7 C 572,123 572.2,126.4 572.3,129.7','M 572.4,222 C 572.5,225.8 572.7,229.7 572.7,233.5 C 572.7,236.6 576.7,233.6 577.7,232.1 C 579.1,230.1 580.6,228.2 582,226.2 C 586.3,219.9 591,213.7 594.4,206.8 C 599.1,197.3 595.8,188.4 593.6,178.8 C 592.8,174.8 591.9,170.3 595.6,167.8 C 597.6,166.4 600.7,166.2 603,165.8 C 604.1,165.6 605.1,165.6 606.2,165.5 C 609.4,165.3 617.1,164.9 616.3,159.3 C 609.7,160.4 601.2,159.1 597.4,158.5 C 593.1,157.9 589,156.5 585.3,154.5 C 579,158 574.6,163.3 572.8,170.5 C 570.6,179.3 572.3,188.9 572.6,197.8 C 572.9,205.8 572.3,213.9 572.4,222','M 569.6,221.9 C 569.6,225.8 569.3,229.7 569.4,233.5 C 569.4,236.6 565.4,233.6 564.4,232.1 C 563,230.1 561.5,228.2 560.1,226.2 C 555.8,219.9 551.1,213.6 547.7,206.8 C 543,197.2 546.3,188.3 548.4,178.7 C 549.3,174.8 550.2,170.3 546.5,167.7 C 544.5,166.3 541.4,166.1 539.1,165.8 C 538,165.6 537,165.6 535.9,165.5 C 532.6,165.3 525,164.9 525.8,159.2 C 532.4,160.4 540.9,159.1 544.7,158.5 C 549,157.8 553.1,156.5 556.8,154.5 C 563,158 567.5,163.3 569.3,170.5 C 571.5,179.2 569.8,188.9 569.5,197.8 C 569.2,205.8 569.8,213.9 569.6,221.9'],
  LOWER_BACK: ['M 585.9,279.6 C 588.6,281.6 587.8,285.4 587.5,286.5 C 587,288.8 575.8,303.3 571.9,307.1 C 571.6,307.4 570.6,307 570.3,306.7 C 566.1,302.9 554.9,288.7 554.3,286.4 C 554.1,285.3 554,281.8 556.6,279.7 C 560.4,277.9 561.2,270.2 562.1,267.3 C 564.3,259.7 566,252.1 567.1,244.2 C 568,242.5 569.6,240.1 570.4,239 C 571,238.2 571.6,238.3 572.2,239.1 C 572.9,240.2 574.4,242.6 575.2,244.4 C 576.3,252.2 578.2,259.9 580.4,267.4 C 581.3,270.2 582.3,277.7 585.9,279.6'],
  ABS: ['M 123.2,257.3 C 119.4,258.5 115.6,259.7 111.8,260.9 C 107,262.4 106.1,258.7 106,255.9 C 106,253.2 107.5,250.7 109.2,248.6 C 112.1,245.3 117.2,244.2 121.5,243.9 C 126.7,243.6 128.2,255.6 123.2,257.3','M 131.5,257.4 C 135.3,258.5 139.1,259.7 142.9,261 C 147.7,262.5 148.7,258.8 148.7,256 C 148.7,253.2 147.3,250.7 145.5,248.7 C 142.6,245.3 137.6,244.3 133.2,244 C 128.1,243.7 126.5,255.7 131.5,257.4','M 121.1,241 C 117.9,241.5 114.9,242.6 111.7,243.7 C 103.3,246.6 106.3,235.8 108.6,232.1 C 111.3,227.8 116.7,225.3 121.5,224.5 C 127.4,223.4 126,230.3 125.9,232.9 C 125.8,236.4 126.1,240.4 121.1,241','M 133.4,241 C 136.7,241.5 139.8,242.7 142.9,243.8 C 151.5,246.7 148.4,235.8 146.1,232.1 C 143.4,227.8 137.9,225.4 133,224.5 C 127.1,223.4 128.4,230.3 128.5,232.8 C 128.7,236.3 128.4,240.3 133.4,241','M 125.4,214.9 C 124.8,218.2 122.2,220 119.5,221.5 C 116.7,223.2 106.9,229.6 106.2,223 C 105.5,217.3 107.2,213.2 112.5,210.7 C 115.7,209.1 120.8,206.1 124.4,206.7 C 126.8,208.1 125.8,212.8 125.4,214.9','M 128.7,215 C 129.3,218.2 132,220 134.6,221.6 C 137.4,223.2 147.3,229.7 148,223 C 148.6,217.3 147,213.3 141.7,210.7 C 138.5,209.1 133.3,206.1 129.8,206.7 C 127.3,208.1 128.3,212.8 128.7,215','M 124.7,290.6 C 124.6,294.6 124.5,298.7 124.3,302.8 C 124.1,309.3 116.5,302.6 114.9,300.7 C 110.2,293.8 108.9,284.7 107.4,276.6 C 106.1,270 108.3,264.6 115,262.5 C 119.8,261.1 124.9,260.9 125.3,267.2 C 125.8,274.9 124.9,282.9 124.7,290.6','M 130.1,290.6 C 130.2,294.6 130.3,298.7 130.4,302.8 C 130.6,309.3 138.2,302.6 139.9,300.7 C 144.6,293.8 145.8,284.7 147.4,276.6 C 148.7,270 146.5,264.6 139.7,262.5 C 134.9,261.1 129.8,260.9 129.4,267.2 C 129,274.9 129.8,282.9 130.1,290.6','M 103.6,220.7 C 103.6,222.1 103.1,223.3 102.6,224.6 C 102.4,225 102.4,225.6 101.9,225.5 C 101.4,225.4 100.9,224.9 100.6,224.6 C 100.1,224.1 99.6,223.7 99.1,223.2 C 98.3,222.5 97.4,221.8 96.7,221.1 C 94.8,218.9 93.1,216.5 91.7,214 C 93.7,213.8 95.6,213.3 97.5,212.7 L 97.6,212.8 C 100.8,214.4 103.5,217.2 103.6,220.7 L 103.6,220.7','M 96.7,221.9 C 93.5,221.5 90.5,220.1 88,217.9 L 88,217.9 C 88,216.7 88.1,215.4 88.4,214.2 C 89.3,214.2 90.2,214.2 91.1,214.1 C 92.3,216.2 93.7,218.3 95.2,220.1 C 95.7,220.8 96.2,221.4 96.7,221.9 L 96.7,221.9','M 102.3,235.8 C 101.6,240.1 98.7,234.8 97.6,233.1 C 95.4,229.9 94,225.8 93.6,221.8 C 94.8,222.3 96.1,222.5 97.4,222.7 C 97.7,223 98,223.3 98.3,223.6 C 98.8,224.1 99.4,224.7 100,225.2 C 100.5,225.6 101,226.5 101.7,226.6 L 101.7,226.7 C 103.9,229 102.7,233.1 102.3,235.8 L 102.3,235.8','M 94.9,229.1 C 92.5,228.3 90.3,226.9 88.6,225.1 C 88.1,222.9 87.9,220.8 87.9,218.7 C 89.4,219.9 91.1,220.9 92.9,221.6 C 93.2,224.2 93.9,226.7 94.9,229.1 L 94.9,229.1','M 101.6,247 C 100.5,247.6 99.5,246.5 98.8,245.8 C 98.1,245.2 97.6,244.5 97.1,243.8 C 94.4,240 93.9,233.9 94,229.4 C 94.4,229.5 94.8,229.7 95.2,229.8 C 96.7,233.3 99,236.4 101.7,238.8 C 101.9,240.5 102.1,242.1 102.3,243.7 C 102.3,244.7 102.7,246.4 101.6,247 L 101.6,247','M 92.3,235.3 L 92.3,235.3 C 91.9,234 91.3,232.4 90.7,230.8 C 90.7,230.8 90.2,229.5 90.1,229.1 C 89.7,228.2 89.4,227.3 89,226.4 C 90.3,227.6 91.8,228.5 93.4,229.2 L 93.4,229.3 C 93.3,231.7 93.4,234.4 93.9,236.9 C 93.3,236.4 92.8,235.9 92.3,235.3 L 92.3,235.3','M 102.5,257.1 C 100.7,257.8 99.7,256.4 98.8,255.1 C 95.9,251.3 93.9,246.9 93.1,242.2 L 93.1,242.2 C 93.1,239.8 93,238.1 92.9,237.4 C 92.9,237.2 92.8,237 92.7,236.7 C 93.2,237.2 93.6,237.6 94.1,238 C 94.9,241.6 96.6,245 99.6,247.2 C 100.6,247.9 101.3,248.1 101.9,248 C 102,248.4 102.1,248.9 102.2,248.9 C 102.4,249.6 102.5,250.2 102.7,250.9 C 102.9,252.1 103,253.4 103.2,254.7 C 103.3,255.6 103.4,256.6 102.5,257.1 L 102.5,257.1','M 102.8,265.1 C 102.9,266 102.4,267.3 101.3,267.2 C 100.8,267.1 100.2,266.9 99.7,266.6 C 97,264.9 94.7,262.4 93,259.7 L 93,259.7 C 93.1,254.8 93.1,249.5 93.1,245.2 C 93.7,247.3 94.6,249.4 95.6,251.4 C 96.7,253.6 99.1,258 101.7,258.8 C 102.1,258.9 102.4,258.9 102.7,258.8 C 102.8,260 102.9,261.2 102.9,262.4 C 102.9,263.3 102.9,264.2 102.8,265.1 L 102.8,265.1','M 151,220.8 C 150.9,222.1 151.5,223.3 152,224.6 C 152.2,225.1 152.3,225.7 152.8,225.6 C 153.3,225.5 153.9,224.9 154.2,224.6 C 154.7,224.1 155.2,223.7 155.7,223.2 C 156.4,222.5 157.3,221.9 158,221.1 C 159.9,218.9 161.8,216.1 163.2,213.6 C 161.2,213.4 159.1,213.1 157.2,212.5 L 157.1,212.5 C 153.9,214.1 151.1,216.8 151,220.8','M 157.5,222.2 C 160.7,221.7 164.3,220.1 166.8,217.9 L 166.8,217.9 C 166.8,216.7 166.8,215.1 166.6,213.9 C 165.6,213.9 164.5,213.7 163.6,213.6 C 162.4,215.7 157.5,222.2 157.5,222.2','M 152.4,236.1 C 153.1,240.4 156,234.8 157.1,233.1 C 159.3,229.9 160.7,225.9 161.2,221.9 C 160,222.3 158.5,222.4 157.1,222.5 C 156.9,222.8 156.6,223.1 156.3,223.4 C 155.7,223.9 155.1,224.5 154.6,225 C 154.1,225.4 153.8,226.1 153,226.2 L 152.8,226.5 C 150.7,228.9 151.9,233.1 152.3,235.9 L 152.4,236.1','M 160,229.1 C 162.4,228.3 164.8,226.8 166.5,224.9 C 167,222.8 167,220.6 167,218.4 C 165.4,219.7 163.5,220.8 161.7,221.5 C 161.4,224 160.6,226.7 159.6,229.1 L 160,229.1 L 160,229.1','M 153.1,247.1 C 154.2,247.8 155.2,246.5 156,245.8 C 156.6,245.2 157.1,244.6 157.6,243.9 C 160.4,240.1 160.9,233.5 160.8,229 C 160.4,229.2 160,229.3 159.6,229.4 C 158,232.9 155.6,236 152.9,238.5 C 152.7,240.1 152.5,242.1 152.3,243.8 C 152.2,244.7 151.9,246.5 152.9,247 L 153.1,247.1','M 162.4,235.3 L 163,234.6 C 163.4,233.3 164.6,230.2 164.6,230.2 C 164.6,230.2 166,226.3 166.3,225.4 C 165.1,226.6 163.5,227.8 161.9,228.4 L 161.2,228.9 C 161.3,231.3 161.2,234.3 160.7,236.9 C 161.3,236.4 161.6,236.1 162.1,235.5 L 162.4,235.3','M 152.1,257.3 C 153.8,258.1 155.1,256.4 156,255.2 C 158.9,251.4 160.8,247.3 161.7,242.7 L 162.2,240.5 C 162.2,238.1 162.1,237.6 162.2,236.9 C 162.3,236.7 162.5,236.1 162.5,235.8 C 162.1,236.3 160.9,237.2 160.5,237.6 C 159.6,241.3 158.1,244.5 155.1,246.7 C 154.1,247.4 153.3,247.7 152.8,247.5 C 152.7,247.9 152.4,248.9 152.4,249 C 152.2,249.6 152,250.2 151.9,250.9 C 151.7,252.2 151.5,253.5 151.3,254.8 C 151.2,255.6 151.3,256.9 152.3,257.3 L 152.1,257.3','M 151.9,265.1 C 151.8,266 152.4,267.3 153.4,267.2 C 153.9,267.1 154.6,266.9 155,266.6 C 157.8,264.9 160,262.7 162.1,259.2 C 162.1,259.2 161.9,247.6 161.9,243.4 C 161.3,245.5 160.2,249 159.1,251 C 158,253.2 155.7,257.6 153.1,258.3 C 152.7,258.5 152.3,258.5 152,258.4 C 151.9,259.6 151.9,261.2 151.9,262.4 C 151.9,263.3 151.9,264.2 151.9,265.1 L 151.9,265.1'],
  OBLIQUES: ['M 105.2,283.1 C 104.7,285.6 102.5,288.3 101,290.2 C 98.8,292.8 96.8,291.6 94.5,289.8 C 92.6,288.2 90.6,286.6 88.7,285.1 L 88.7,285 C 88.4,283.9 87.9,281.9 87.4,278.3 C 86.9,274.1 89.7,269.6 91.4,266.9 C 91.7,266.4 92,266 92.2,265.6 C 98.9,268.7 107,274 105.2,283.1','M 149.6,283.1 C 150.1,285.6 152.3,288.3 153.8,290.2 C 156,292.9 158,291.7 160.3,289.9 C 162.2,288.3 164.1,286.7 166.1,285.1 L 166.3,285 C 166.7,283.9 167.2,281.9 167.6,278.3 C 168.1,274.1 165.2,269.6 163.5,266.9 C 163.2,266.4 162.9,266 162.8,265.6 C 156,268.7 147.7,274.1 149.6,283.1','M 610.5,290.3 C 610.5,290.3 616.9,279 606.5,265.7 C 604.5,271 596.1,277.6 591.3,279.3 C 594.1,280.9 597.3,282.7 599.4,283.5 C 603.2,284.8 609.3,288.7 610.5,290.3','M 531.5,290.3 C 531.5,290.3 525,279 535.5,265.7 C 537.5,271 545.9,277.6 550.7,279.3 C 547.9,280.9 544.7,282.7 542.6,283.5 C 538.8,284.8 532.6,288.7 531.5,290.3','M 593.8,277.7 C 593.8,277.7 593.8,277.7 593.8,277.7 C 594.2,277.4 594.6,277.2 595,276.9 C 594.8,276.7 594.7,276.4 594.6,276.2 C 595,275.6 595.4,275 595.7,274.3 C 600.2,266.7 604.9,258.8 606.1,250 C 606.1,251.2 606.1,252.4 606.1,253.6 C 604.3,261.1 600.2,268 596.3,274.7 C 595.9,275.4 595.4,276.2 595,276.9 C 594.6,277.2 594.2,277.4 593.8,277.7','M 548.3,277.7 C 548.3,277.7 548.3,277.7 548.3,277.7 C 547.9,277.4 547.5,277.2 547.1,276.9 C 547.3,276.7 547.4,276.4 547.5,276.2 C 547.1,275.6 546.8,275 546.4,274.3 C 541.9,266.7 537.3,258.8 536,250 C 536,251.2 536,252.4 536,253.6 C 537.8,261.1 541.9,268 545.8,274.7 C 546.3,275.4 546.7,276.2 547.1,276.9 C 547.5,277.2 547.9,277.4 548.3,277.7'],
  GLUTES: ['M 91.2,308.9 C 90.2,316 88.8,325.7 82,329.4 C 82.1,329.2 82.1,328.9 82.2,328.7 C 84,321.7 85.4,316.1 85.1,312.4 C 84.6,305.2 86.8,295.2 88.2,289.9 C 92.4,294.5 92.2,301.6 91.3,307.6 L 91.2,308.9','M 163.8,308.4 C 163.1,301.5 162.8,294.4 166.9,289.9 C 168.3,295.1 170.5,305.2 170,312.4 C 169.8,316.1 173.1,324.7 173.3,329.8 C 168.5,328.6 165,320.7 163.8,308.4','M 572.9,337.5 C 574.4,344 582,346.9 587.6,348.7 L 587.6,348.7 C 593.1,350.4 598.4,352.5 603.9,354.2 C 614.4,357.5 607.6,341 606.1,336.5 C 604.5,331.9 603.1,326.6 604,321.7 C 604.4,319.3 605.1,317.4 606.2,315.3 C 608.7,310.7 600.6,308 598,306.7 C 591.9,303.3 584.1,298.2 577.9,304.1 C 576.6,306.2 575.3,308.4 574.3,310.7 L 574.3,310.7 C 573.6,313.1 573.2,315.6 572.8,317.9 C 571.8,324.3 571.5,331.1 572.9,337.5','M 569.2,337.5 C 567.7,344 560.1,346.9 554.5,348.7 L 554.5,348.7 C 549,350.4 543.6,352.5 538.2,354.2 C 527.6,357.5 534.5,341 536,336.5 C 537.5,331.9 539,326.6 538.1,321.7 C 537.6,319.3 537,317.4 535.9,315.3 C 533.4,310.7 541.5,308 544.1,306.7 C 550.2,303.3 558,298.2 564.2,304.1 C 565.5,306.2 566.8,308.4 567.8,310.7 L 567.8,310.7 C 568.5,313.1 568.9,315.6 569.3,317.9 C 570.3,324.3 570.6,331.1 569.2,337.5','M 563.6,303.3 C 560.7,300.7 556.6,299.9 550.8,302.4 C 547.1,303.9 543.6,306.1 540.1,308.1 C 539.2,308.5 534.2,310.3 534.2,312.2 L 534.2,312.2 C 531.7,313.8 529.6,315.7 527.7,317.9 C 527.7,317.2 527.7,316.6 527.7,315.9 C 527.1,307.3 530.2,295.8 531.5,291.4 C 539.2,285.7 547.4,282.7 554.7,291.4 C 557.8,295.2 560.9,299.1 563.6,303.3','M 578.4,303.3 C 581.3,300.7 585.4,299.9 591.3,302.4 C 595,303.9 598.4,306.1 601.9,308.1 C 602.8,308.5 607.8,310.3 607.9,312.2 L 607.9,312.2 C 610.3,313.8 612.5,315.7 614.4,317.9 C 614.3,317.2 614.3,316.6 614.4,315.9 C 614.9,307.3 611.9,295.8 610.6,291.4 C 602.9,285.7 594.7,282.7 587.4,291.4 C 584.2,295.2 581.1,299.1 578.4,303.3','M 605.2,312.7 C 605.2,312.7 608.6,313.6 613.1,319.3 C 613.3,320.4 614,323.4 614.7,326.7 C 615.4,329.9 622.1,348.4 622.6,371.3 C 622.9,386.5 621.8,395.2 621.1,405.2 C 619.2,397.3 618.2,383.2 615.8,373 C 613.4,362.8 610.3,353 608.5,350.9 C 608.4,349.1 608.2,347.3 605.7,340.1 C 603.3,332.8 600.3,325.7 604.6,316.5 C 605.2,315.3 605.8,314.8 605.2,312.7','M 533.5,312.9 C 533.5,312.9 530,313.8 525.6,319.6 C 525.4,320.7 524.6,323.6 524,326.9 C 523.3,330.2 516.5,348.7 516.1,371.6 C 515.7,386.8 516.9,395.5 517.6,405.5 C 519.5,397.6 520.5,383.5 522.9,373.3 C 525.3,363.1 528.4,353.2 530.1,351.1 C 530.2,349.4 530.5,347.5 532.9,340.3 C 535.3,333.1 538.4,326 534.1,316.8 C 533.5,315.6 532.9,315.1 533.5,312.9'],
  QUADS: ['M 90.2,396.4 C 88.1,386.5 83.6,376.5 81.7,367.6 C 79.6,357.4 78.8,349.1 79.7,338.9 C 78.1,346.2 76.5,355 75.1,363.8 C 73.2,376.1 73.1,388.6 79.5,422.6 C 80.2,426.4 87.6,421.6 89.2,417.7 C 90.3,415.1 91.2,411 91.3,408.1 C 91.3,408.1 91.1,400.9 90.2,396.4','M 164.6,396.6 C 166.7,386.7 171.2,376.6 173.1,367.8 C 175.2,357.6 176.2,349.4 175.3,339.1 C 176.9,346.4 178.5,354.6 179.9,363.4 C 181.8,375.7 181.7,388.7 175.3,422.8 C 174.6,426.6 167.2,421.8 165.5,417.9 C 164.4,415.3 163.6,411.2 163.5,408.3 C 163.5,408.3 163.7,401.1 164.6,396.6','M 117.5,394.6 C 117.1,387.2 116.3,381.2 114.9,373.9 C 113.9,368.5 111.9,362.6 109.8,357.6 C 106.3,369.6 98.2,380.6 95.5,392.8 C 94,399.4 93.9,406.7 97.3,412.8 C 100.5,418.5 108.9,425.6 115.3,420.5 C 115.8,416.6 117.4,399.1 117.7,396.1 L 117.5,394.6','M 137.6,396.2 C 137.7,399.2 138.3,402.1 138.5,405 C 139,410.8 139.5,416.4 140,420.3 C 146.4,425.4 154.4,418.5 157.6,412.8 C 161.1,406.7 161,399.3 159.5,392.7 C 156.8,380.6 147.5,365 145.2,357.6 C 141.4,363.3 137,383.8 137.6,396.2','M 174.5,334.2 C 174.1,332.7 174.2,332.2 173.9,330.9 L 173.6,329.8 C 165.7,326.2 164.9,316 163.6,308.4 C 162.5,302.1 162.3,294.5 167,289.8 C 166.4,287.9 165.7,286.1 165.7,286.1 L 165.4,286.2 C 162.6,288.6 159.8,290.9 156.7,292.9 C 156.5,293 156.4,293.1 156.3,293.1 C 154.6,295.4 153.1,298.2 151.4,301.5 L 151.4,308.1 C 151.5,307.4 152.3,304.1 152.5,303.5 C 153.2,300.5 155.5,297.4 157.2,295 C 157.7,294.3 158.8,293.5 159.6,294.1 C 163.7,296.9 161.3,306.8 160.8,310.6 C 159.5,321.4 155.9,331.8 151.8,341.8 C 149.7,347.1 147.2,352 144.9,357.2 C 148.7,370.8 160.1,384.3 160.9,398.7 L 160.9,398.7 C 161.9,399.4 163.2,399.4 164.2,398.9 C 164.3,396.5 164.9,394.2 165.3,392.1 C 167.5,381.6 172.4,372 174.2,361.3 C 175.7,352.4 175.8,343.1 174.5,334.2','M 80.7,334.4 C 81,333 81.4,331.5 81.7,330.2 L 81.8,329.8 C 89.6,326.2 90,316.2 91.3,308.5 C 92.3,302.2 92.6,294.6 87.9,290 C 88.5,288 89.3,286 89.3,286 L 89.6,286.1 C 92.4,288.5 95.3,290.8 98.3,292.8 C 98.5,292.9 98.5,293.2 98.6,293.3 C 100.3,295.6 101.8,298.4 103.5,301.7 L 103.5,308.5 C 103.4,307.8 102.5,304.3 102.4,303.6 C 101.7,300.7 99.3,297.6 97.7,295.1 C 97.2,294.4 96.1,293.6 95.3,294.2 C 91.2,297.1 93.6,306.9 94,310.7 C 95.3,321.5 99,331.9 103,342 C 105.1,347.2 107.7,352.2 110,357.3 C 106.2,370.9 94.7,384.4 94,398.8 L 94,398.8 C 93,399.5 91.7,399.5 90.7,399 C 90.6,396.6 90.3,394.2 89.8,392.1 C 87.7,381.6 82.5,372.1 80.7,361.4 C 79.2,352.5 79.4,343.4 80.7,334.4','M 119.6,377.4 C 119.2,379.4 118.9,381.3 118.7,383.2 C 118.3,386 117.9,389.4 117.6,392.6 C 116.7,380.7 114.9,368.6 110,357.5 C 102,339 94.2,321.1 93.8,300.6 C 93.8,299.2 93.9,298 94.1,296.7 C 95.3,291.1 98.9,298.1 99.7,299.3 C 101.1,301.6 102.3,303.2 102.6,306 C 102.8,307.3 102.9,309 103.2,310.3 C 105.1,319.4 106.9,328.1 110.2,336.9 C 111.7,340.9 113.7,344.7 115.1,348.8 C 116.8,353.3 117.4,358.4 118.2,363.1 C 119,367.9 119.4,372.4 119.6,377.2 L 119.6,377.4','M 135.5,377.2 C 135.9,379.1 136.2,381 136.4,382.9 C 136.8,385.6 137.2,388.8 137.5,391.9 C 138.3,380.1 140.1,368.3 144.9,357.2 C 152.9,338.7 161.1,320.8 161.5,300.3 C 161.5,299 161.4,297.3 161.1,296 C 159.4,289.8 154.9,299.1 154.8,299.4 C 153.6,301.7 152.8,303.4 152.4,306.2 C 152.3,307.5 152.1,308.8 151.9,310.1 C 149.9,319.1 148.2,327.6 145,336.4 C 143.5,340.4 141.5,344.2 140,348.2 C 138.4,352.8 137.7,358.1 136.9,362.9 C 136.1,367.6 135.7,372.4 135.5,377.2'],
  HAMSTRINGS: ['M 560.2,405.7 C 560.1,407.5 559.9,409.2 559.8,410.9 C 559.1,418.9 558.5,426.4 557.8,430.1 C 557.4,432.5 556.2,435.8 554.6,439.3 C 557.6,421.1 549.8,401.5 555.9,384.1 C 557.1,391.3 558.8,398.5 560.2,405.7','M 581.8,405.7 C 582,407.5 582.1,409.2 582.3,410.9 C 582.9,418.9 583.6,426.4 584.3,430.1 C 584.7,432.5 585.9,435.8 587.4,439.3 C 584.5,421.1 592.2,401.5 586.1,384.1 C 585,391.3 583.3,398.5 581.8,405.7','M 597.3,368.6 C 598,377.5 599.4,386.5 601.2,395.3 C 604.2,410.1 610.3,424.2 616.4,438.1 L 616.5,438.3 C 617.2,439.8 617.8,441.2 618.4,442.7 C 618.6,443.2 618.8,443.7 619,444.1 C 619.1,444 619.1,443.8 619.1,443.6 C 619.3,440.8 619.1,439.3 618.9,437.9 C 618.8,436.9 618.7,435.9 618.7,434.5 C 618.8,434 619,432.3 619.3,429.7 C 620,424.2 621.2,414.8 622.2,404.3 L 622.2,404.3 C 619.7,386.6 617.7,368.9 610.8,352.1 C 610.6,353.4 610.1,354.3 609,354.7 C 606.9,355.5 604.9,355.2 602.8,354.5 C 601,353.9 599.2,353.3 597.4,352.7 C 596.3,357.8 597,363.7 597.3,368.6','M 544.8,368.3 C 544.1,377.3 542.7,386.2 540.9,395 C 537.9,409.9 531.9,423.9 525.8,437.8 L 525.6,438.1 C 525,439.5 524.3,441 523.7,442.5 C 523.5,442.9 523.3,443.4 523.1,443.9 C 523.1,443.7 523.1,443.5 523,443.4 C 522.8,440.5 523,439 523.2,437.7 C 523.4,436.6 523.5,435.7 523.4,434.3 C 523.4,433.7 523.2,432 522.8,429.4 C 522.1,424 520.9,414.6 519.9,404.1 L 519.9,404.1 C 522.5,386.3 524.4,368.6 531.4,351.9 C 531.5,353.1 532.1,354.1 533.1,354.5 C 535.2,355.3 537.2,354.9 539.3,354.3 C 541.1,353.7 542.9,353.1 544.8,352.4 C 545.9,357.6 545.2,363.5 544.8,368.3','M 569.5,351.5 C 569.2,354.1 568.2,358.4 567,363.5 C 565.2,371 563,380.3 562,388.5 C 561.4,393.1 560.9,398.3 560.4,403.6 C 556.6,385.1 551.7,366.4 558.3,348.1 C 562.4,346.4 566.1,344.2 568.6,340.4 C 568.8,340.1 569,339.8 569.1,339.5 C 569.5,341.5 570.1,346.5 569.5,351.5','M 572.6,351.5 C 572.9,354.1 573.9,358.4 575.1,363.5 C 576.9,371 579,380.3 580.1,388.5 C 580.7,393.1 581.2,398.3 581.6,403.6 C 585.5,385.1 590.3,366.4 583.8,348.1 C 579.7,346.4 575.9,344.2 573.4,340.4 C 573.2,340.1 573.1,339.8 572.9,339.5 C 572.6,341.5 571.9,346.5 572.6,351.5','M 586.4,382.8 C 593.4,401.4 584.2,422.3 588.5,441.5 C 589.8,444.1 591.2,446.8 592.8,449.3 C 593.8,445.5 594.6,442.5 594.6,442.5 L 594.6,442.3 C 598.5,430.5 605.5,420.5 604.3,408.9 L 604.3,408.8 L 604.3,408.8 C 602.5,403.3 601,397.6 599.9,391.8 C 598.3,383.4 597.1,374.8 596.5,366.2 C 596.3,361.9 595.8,356.9 596.8,352.5 C 593.7,351.4 590.6,350.3 587.5,349.4 C 586.5,349.1 585.5,348.7 584.6,348.4 C 588.5,359.7 588.1,371.2 586.4,382.8','M 555.8,382.8 C 548.7,401.4 557.9,422.3 553.6,441.5 C 552.3,444.1 550.9,446.8 549.3,449.3 C 548.3,445.5 547.5,442.5 547.5,442.5 L 547.5,442.3 C 543.6,430.5 536.6,420.5 537.8,408.9 L 537.8,408.8 L 537.8,408.8 C 539.6,403.3 541.1,397.6 542.2,391.8 C 543.8,383.4 545,374.8 545.6,366.2 C 545.9,361.9 546.3,356.9 545.3,352.5 C 548.4,351.4 551.5,350.3 554.6,349.4 C 555.6,349.1 556.6,348.7 557.5,348.4 C 553.6,359.7 554,371.2 555.8,382.8'],
  ADDUCTORS: ['M 105.24000000000001,300.0 L 128.14000000000001,334.5 L 128.24,335.2 L 128.34,335.9 L 128.44,336.8 L 128.54,337.9 L 128.54,338.8 L 128.64000000000001,339.6 L 128.64000000000001,340.5 L 128.74,341.4 L 128.74,342.3 L 128.74,343.2 L 128.64000000000001,344.1 L 128.64000000000001,344.9 L 128.54,345.8 L 128.44,346.6 L 128.34,347.5 L 128.24,348.4 L 128.04,349.2 L 127.94,349.9 L 127.74000000000001,350.8 L 127.53999999999999,351.6 L 127.34,352.5 L 122.34,375.3 L 109.64000000000001,325.6 L 109.14000000000001,323.8 L 108.94,323.0 L 108.74000000000001,322.1 L 108.64000000000001,321.3 L 108.34,319.8 L 108.14000000000001,318.9 L 107.94,318.1 L 107.84,317.2 L 107.64000000000001,316.4 L 107.44,315.5 L 107.34,314.7 L 105.94,307.0 L 105.24000000000001,300.0','M 131.34,342.7 L 131.34,341.8 L 131.34,340.9 L 131.44,340.0 L 131.44,339.2 L 131.54,338.3 L 131.64000000000001,337.3 L 131.74,336.3 L 131.84,335.5 L 131.94,334.8 L 154.64000000000001,300.6 L 154.74,300.6 L 154.14000000000001,306.7 L 154.04,307.6 L 152.74,314.5 L 152.64000000000001,315.4 L 152.44,316.2 L 152.34,317.1 L 152.14000000000001,318.0 L 151.94,318.8 L 151.84,319.7 L 151.64000000000001,320.5 L 150.54,325.2 L 137.74,377.1 L 137.34,376.3 L 136.94,375.5 L 131.94,348.8 L 131.84,347.9 L 131.64000000000001,347.0 L 131.54,346.2 L 131.44,345.4 L 131.44,344.5 L 131.34,343.6 L 131.34,342.7','M 568.1,351.8 C 567.8,354.4 566.7,358.8 565.5,363.9 C 563.8,371.5 561.6,380.8 560.5,389.1 C 559.9,393.7 559.4,399 559,404.2 C 555.1,385.6 550.2,366.8 556.8,348.4 C 560.9,346.8 564.7,344.6 567.2,340.7 C 567.4,340.4 567.6,340.1 567.7,339.8 C 568,341.8 568.7,346.9 568.1,351.8','M 570.7,351.8 C 571.1,354.4 572.1,358.8 573.4,363.9 C 575.2,371.5 577.4,380.8 578.5,389.1 C 579.1,393.7 579.7,399 580.1,404.2 C 584.1,385.6 589.1,366.8 582.4,348.4 C 578.1,346.8 574.2,344.6 571.6,340.7 C 571.4,340.4 571.3,340.1 571.1,339.8 C 570.8,341.8 570.1,346.9 570.7,351.8','M 558,404.8 C 557.8,406.5 557.7,408.3 557.6,409.9 C 556.9,417.9 556.3,425.4 555.6,429.1 C 555.1,431.5 554,434.8 552.4,438.2 C 555.4,420.1 547.6,400.6 553.7,383.1 C 554.9,390.3 556.5,397.6 558,404.8','M 579.5,404.8 C 579.7,406.5 579.9,408.3 580,409.9 C 580.7,417.9 581.3,425.4 582,429.1 C 582.4,431.5 583.6,434.8 585.1,438.2 C 582.2,420.1 589.9,400.6 583.9,383.1 C 582.7,390.3 581,397.6 579.5,404.8'],
  CALVES: ['M 84.8,487.3 C 84.9,474.5 85,462.6 85.1,449.8 C 83.4,446.6 81,441.6 80,438.6 C 78.3,442.6 73.1,455.6 73,463.8 C 72.9,468.4 74.4,478.9 76,490 C 77.8,502.7 79.9,515.7 79.5,521.1 C 79.5,521.8 79.6,522.6 79.6,523.1 C 86.4,513.3 84.7,499.3 84.8,487.9 L 84.8,487.3 L 84.8,487.3','M 170.4,487.3 C 170.3,474.5 170.2,462.6 170.1,449.8 C 171.8,446.6 174.2,441.6 175.2,438.6 C 176.9,442.6 182.1,455.6 182.2,463.8 C 182.3,468.4 180.8,478.9 179.2,490 C 177.4,502.7 175.3,515.7 175.7,521.1 C 175.7,521.8 175.6,522.6 175.6,523.1 C 168.8,513.3 170.5,499.3 170.4,487.9 L 170.4,487.3 L 170.4,487.3','M 156.9,506.7 C 158.6,514.5 160,521.8 159.5,524.4 C 159.5,524.8 159.6,526.4 159.3,526.6 C 164.1,522.6 164.1,514.7 164.1,508.8 C 164.1,507.9 164.1,507.1 164.1,506.2 C 164.2,500.9 164.4,488.7 163.7,483.6 C 159.9,492.5 158.9,492.3 154.6,495.7 L 156.8,505.5 L 156.9,506.7','M 98.2,506.8 C 96.5,514.6 95,521.8 95.5,524.5 C 95.6,524.9 95.5,526.4 95.8,526.7 C 91,522.7 91,514.8 91,508.8 C 90.9,507.9 90.9,507.1 90.9,506.3 C 90.8,501 90.7,488.8 91.4,483.6 C 95.1,492.6 96.2,492.3 100.5,495.7 L 98.3,505.6 L 98.2,506.8','M 110.1,470.6 C 108.3,476.5 106.1,481.2 104.3,485 C 103.2,487.3 102.3,489.2 101.6,491 C 101.4,491.7 101,492.8 100.6,494.2 C 94.8,491.4 92.6,485.8 91.9,479.8 L 91.9,479.8 C 92,478.6 92.1,477.5 92.2,476.2 C 92.4,471.8 92.6,467.2 94,462.9 C 95,459.7 96.6,456.7 98.6,453.9 C 100.5,451.1 102.9,448.6 104.9,445.9 C 106.1,444.3 107.2,442.6 108.2,440.9 C 109.2,445.8 112.4,462.8 110.1,470.6','M 144.9,470.5 C 146.7,476.4 148.9,481.1 150.8,484.8 C 151.8,487.1 152.8,489.1 153.4,490.9 C 153.7,491.6 154,492.6 154.4,494 C 160.3,491.2 162.5,485.6 163.1,479.7 L 163.1,479.6 C 163,478.4 163,477.3 162.9,476.1 C 162.6,471.6 162.5,467.1 161.1,462.8 C 160.1,459.5 158.4,456.5 156.5,453.7 C 154.6,450.9 152.1,448.5 150.1,445.7 C 148.9,444.1 147.8,442.5 146.8,440.7 C 145.8,445.6 142.6,462.7 144.9,470.5','M 526.5,528.2 L 526.5,528.2 C 525.3,532.5 523.2,536.3 520.3,539.7 C 520.7,538.7 521.1,537.6 521.4,536.2 C 523.1,529.8 522.4,522.9 521.6,516.2 L 521.5,515.3 C 520.9,511.6 520.2,507.9 519.6,504.2 C 516.5,487.8 513.6,472.3 519.4,457 C 518.2,469.5 519.7,482 521.6,494.5 L 521.6,494.5 L 521.6,494.5 C 521.7,494.7 521.7,494.8 521.7,494.9 C 523.5,506 525.6,517.1 526.5,528.2','M 615.6,528.2 L 615.6,528.2 C 616.8,532.5 618.9,536.3 621.7,539.7 C 621.4,538.7 621,537.6 620.6,536.2 C 618.9,529.8 619.7,522.9 620.5,516.2 L 620.6,515.3 C 621.1,511.6 621.8,507.9 622.5,504.2 C 625.6,487.8 628.5,472.3 622.7,457 C 623.9,469.5 622.4,482 620.4,494.5 L 620.4,494.5 L 620.4,494.5 C 620.4,494.7 620.4,494.8 620.4,494.9 C 618.6,506 616.4,517.1 615.6,528.2','M 537.4,456.9 C 534.9,464.3 533.6,472 533.1,480.1 C 532.8,485.8 532.6,491.6 532.6,497.3 C 529.7,501.1 523.1,499.9 522.3,494.4 L 522.2,494.2 C 520.1,481.1 518.6,468 520.3,454.8 L 520.4,454.6 C 521.8,450.5 524.4,443.3 526.2,438.5 L 526.2,438.3 C 527.1,436.4 527.9,434.4 528.7,432.5 C 534.6,439.4 537.7,447.9 537.4,456.9','M 604.7,456.9 C 607.1,464.3 608.5,472 609,480.1 C 609.3,485.8 609.4,491.6 609.5,497.3 C 612.4,501.1 619,499.9 619.8,494.4 L 619.8,494.2 C 621.9,481.1 623.4,468 621.7,454.8 L 621.7,454.6 C 620.3,450.5 617.7,443.3 615.9,438.5 L 615.9,438.3 C 615,436.4 614.2,434.4 613.3,432.5 C 607.4,439.4 604.4,447.9 604.7,456.9','M 587.9,473 C 587.9,475.8 588.9,478.7 589.8,481.5 C 590.3,482.9 590.8,484.4 591.1,485.8 L 592,487.9 C 594.4,493.2 596.7,498.6 598.7,504.1 C 601.5,507.9 607.1,506.9 608.7,503 L 608.7,503 C 608.8,495.9 608.6,488.9 608.4,481.9 C 608.1,473.3 606.8,465.1 604.1,457.3 L 604,457 C 602,451.2 599.3,445.8 595.8,440.7 C 595.3,442 594.9,443.3 594.5,444.5 C 594.2,450.3 592.3,455.4 590.8,460.8 C 589.5,465 588.3,469 587.9,473','M 554.1,473 C 554.1,475.8 553.1,478.7 552.2,481.5 C 551.7,482.9 551.2,484.4 550.9,485.8 L 550,487.9 C 547.6,493.2 545.3,498.6 543.3,504.1 C 540.5,507.9 534.9,506.9 533.2,503 L 533.2,503 C 533.2,495.9 533.3,488.9 533.6,481.9 C 533.9,473.3 535.2,465.1 537.9,457.3 L 538,457 C 540,451.2 542.6,445.8 546.2,440.7 C 546.7,442 547.1,443.3 547.5,444.5 C 547.8,450.3 549.6,455.4 551.2,460.8 C 552.5,465 553.6,469 554.1,473'],
  NECK: ['M 134.7,160.3 C 135.9,157.3 137.4,153.5 138.6,150.6 C 140.8,156.4 146.6,160.8 152.8,161.6 C 146.8,163.3 139.8,164.7 134.8,160.8 L 134.7,160.3','M 120,160.4 C 118.8,157.3 117.4,153.6 116.2,150.7 C 113.9,156.5 108.8,161 102.6,161.8 C 108.7,163.5 115.8,164.3 120.1,160.8 L 120,160.4','M 138.9,150.3 L 138.9,150.3 C 141.1,156.8 146.8,161 153.7,161.2 C 155.9,160.5 158.5,159.4 160.2,158.7 C 159,158.5 157.7,158 156.6,157.4 C 149.7,153.9 148.2,143.6 142.6,138.6 C 142.1,141 141.5,143.8 140.8,145.6 C 140.3,146.6 139.7,148.3 138.9,150.3','M 116,149.9 C 115.2,148 114.6,146.4 114.1,145.3 C 113.4,143.6 112.8,141.1 112.3,138.7 C 106.7,143.8 105.1,154.2 98.2,157.8 C 97.1,158.4 95.9,158.8 94.8,159 C 96.5,159.7 98.8,160.9 101,161.6 C 107.9,161.4 113.8,156.7 116,150.2 L 116,149.9','M 131.3,169.3 C 132.8,165.5 138.6,150 140.4,145.6 C 142.5,140.6 143.8,129.5 143.8,129.4 L 143.8,129.3 C 143.7,128.4 143.8,127 143.8,126.4 C 143,127.3 141.3,128.5 140,129.6 L 139.8,130.1 C 137.7,137.3 135.7,142.4 134,146.4 C 132.9,149.2 131.9,151.6 131.2,154 C 129.8,158.8 130.5,164.5 130.9,167 L 131.3,169.3','M 123.7,168.2 C 124.1,165.7 124.8,158.9 123.4,154.1 C 122.7,151.7 121.7,149.2 120.6,146.4 C 118.9,142.4 116.9,137.6 114.8,130.4 L 114.7,130.1 C 113.4,129 112.2,127.9 111.4,127 C 111.3,127.6 111.2,128.6 111.1,129.5 L 111.1,129.6 C 111.1,129.7 112.2,140.4 114.3,145.4 C 116.1,149.9 121.9,165 123.4,168.8 L 123.7,168.2'],
};
// One deltoid cap per shoulder. Side delt is the outer 45%, front delt the inner
// remainder, separated by a clip rather than by cutting the geometry.
const DELT_CAPS = [{d:'M 88.5,169.2 C 87.8,171.4 86.6,173.4 85,175.2 C 83.9,176.2 82.9,177.3 82,178.4 L 81.7,178.8 C 79.5,181.7 77.8,185.1 77.2,188.9 L 77.2,189 C 75.3,192.9 72.8,196.3 69.5,199.2 C 67.6,200.9 65.4,202.2 63.1,203.4 C 59.8,205 58.6,204.8 56.6,202.4 C 56.4,201.7 55,197.6 54.2,192.5 C 53.3,186.9 57.1,172.7 59.4,166.8 C 60.8,163.3 63.7,162 66.2,160.8 C 67.1,160.4 67.9,160 68.6,159.5 C 70.6,163.4 77.1,162.5 80.6,162.2 C 85.3,162 90.2,163.2 88.5,169.2',outer:[52.1,69.7],inner:[69.7,90.8]},{d:'M 165.9,168.3 C 164.7,162.2 169.6,161.6 174.4,161.9 C 177.8,162.1 184.1,163.3 186.1,159.4 C 186.8,159.9 187.8,160.4 188.6,160.8 C 191.2,162 194.2,163.7 195.6,167.3 C 197.9,173.1 201.7,187 200.8,192.6 C 200,197.7 198.6,201.7 198.4,202.4 C 196.4,204.9 194.9,205 191.7,203.4 C 189.4,202.2 187.2,200.9 185.3,199.2 C 182,196.3 179.5,192.9 177.6,189 L 177.6,188.9 C 176.9,185.1 175.3,181.7 173,178.8 C 173,178.8 170.9,175.9 169.9,174.9 C 168.3,173.1 166.6,171.7 165.9,168.3',outer:[185.1,202.9],inner:[163.7,185.1]}];

const MUSCLE_LABEL = {
  CHEST:'Chest', FRONT_DELT:'Front delts', SIDE_DELT:'Side delts', REAR_DELT:'Rear delts',
  TRICEPS:'Triceps', BICEPS:'Biceps', FOREARMS:'Forearms', LATS:'Lats',
  UPPER_BACK:'Upper back', TRAPS:'Traps', LOWER_BACK:'Lower back', ABS:'Abs',
  OBLIQUES:'Obliques', GLUTES:'Glutes', QUADS:'Quads', HAMSTRINGS:'Hamstrings',
  ADDUCTORS:'Adductors', CALVES:'Calves', NECK:'Neck',
};

// Sets per movement pattern — a third lookup beside the rep-range and rest
// tables. 3 across the board for now; change one cell to retune the program.
const SETS = {
  SQUAT:3, HINGE:3, GLUTE:3, LEG_EXT:3, LEG_CURL:3, CALF:3, INCLINE_PRESS:3,
  FLAT_PRESS:3, CHEST_ISO:3, VERT_PUSH:3, HORIZ_PULL:3, VERT_PULL:3, TRAPS:3,
  SIDE_DELT:3, REAR_DELT:3, TRI_OH:3, TRI_PUSHDOWN:3, BICEPS:3, ABS:3,
  NECK_CURL:3, NECK_EXT:3,
};

// 1 = primary (full set), 0.5 = secondary (half set).
// Forearms take a QUARTER set on every pull, curl, shrug and RDL. Grip work on
// those lifts is isometric and near the end of its range, so it earns less than
// the half set a true secondary mover gets. The rule lives in these defaults so
// machine and free-weight versions are treated alike.
// The trunk gets NO credit from compounds: abs and obliques colour only from
// direct ab work, so the chart shows whether the program actually trains them.
const PATTERN_MUSCLES = {
  SQUAT:         { QUADS:1, GLUTES:0.5, ADDUCTORS:0.5 },
  HINGE:         { HAMSTRINGS:1, LOWER_BACK:1, GLUTES:0.5, FOREARMS:0.25 },
  GLUTE:         { GLUTES:1, LOWER_BACK:1, HAMSTRINGS:0.5 },
  LEG_EXT:       { QUADS:1 },
  LEG_CURL:      { HAMSTRINGS:1 },
  CALF:          { CALVES:1 },
  INCLINE_PRESS: { CHEST:1, FRONT_DELT:0.5, TRICEPS:0.5 },
  FLAT_PRESS:    { CHEST:1, TRICEPS:0.5, FRONT_DELT:0.5 },
  CHEST_ISO:     { CHEST:1 },
  VERT_PUSH:     { FRONT_DELT:1, TRICEPS:0.5, SIDE_DELT:0.5, TRAPS:0.5 },
  HORIZ_PULL:    { UPPER_BACK:1, LATS:0.5, BICEPS:0.5, REAR_DELT:0.5, FOREARMS:0.25 },
  VERT_PULL:     { LATS:1, BICEPS:0.5, UPPER_BACK:0.5, FOREARMS:0.25 },
  TRAPS:         { TRAPS:1, FOREARMS:0.25 },
  SIDE_DELT:     { SIDE_DELT:1 },
  REAR_DELT:     { REAR_DELT:1, UPPER_BACK:0.5 },
  TRI_OH:        { TRICEPS:1 },
  TRI_PUSHDOWN:  { TRICEPS:1 },
  BICEPS:        { BICEPS:1, FOREARMS:0.25 },
  ABS:           { ABS:1, OBLIQUES:0.5 },
  NECK_CURL:     { NECK:1 },
  NECK_EXT:      { NECK:1 },
};

// An override replaces its pattern default entirely.
const EXERCISE_MUSCLES = {
  SQUAT_BACK:       { QUADS:1, GLUTES:0.5, ADDUCTORS:0.5, LOWER_BACK:0.5 },
  SQUAT_FRONT:      { QUADS:1, GLUTES:0.5, ADDUCTORS:0.5, LOWER_BACK:0.5, UPPER_BACK:0.5 },
  SPLIT_SQUAT_BULG: { QUADS:1, GLUTES:1, ADDUCTORS:0.5 },
  BACK_EXT_WTD:     { LOWER_BACK:1, GLUTES:0.5, HAMSTRINGS:0.5 },
  DB_FLY_PRESS:     { CHEST:1, FRONT_DELT:0.5, TRICEPS:0.5 },
  DB_FLY_PRESS_INC: { CHEST:1, FRONT_DELT:0.5, TRICEPS:0.5 },
  OHP_BB:            { FRONT_DELT:1, TRICEPS:0.5, SIDE_DELT:0.5, TRAPS:0.5 },
  SHLDR_PRESS_DB_1A: { FRONT_DELT:1, TRICEPS:0.5, SIDE_DELT:0.5, TRAPS:0.5 },
  ROW_PENDLAY:  { UPPER_BACK:1, LATS:0.5, BICEPS:0.5, REAR_DELT:0.5, FOREARMS:0.25, LOWER_BACK:0.5 },
  ROW_INVERTED: { UPPER_BACK:1, LATS:0.5, BICEPS:0.5, REAR_DELT:0.5, FOREARMS:0.25 },
  PULLOVER_DB:  { LATS:1, CHEST:0.5, TRICEPS:0.5, FOREARMS:0.25 },
  SHRUG_KELSO:  { TRAPS:1, UPPER_BACK:0.5, FOREARMS:0.25 },
  CUBAN_PRESS:  { SIDE_DELT:1, REAR_DELT:0.5, FRONT_DELT:0.5 },
  FACE_PULL_CABLE: { REAR_DELT:1, UPPER_BACK:0.5, TRAPS:0.5 },
  SKULLCRUSHER_BB: { TRICEPS:1, FOREARMS:0.25 },
  LEG_RAISE_LYING: { ABS:1, OBLIQUES:0.5, ADDUCTORS:0.5 },
  LEG_RAISE_CHAIR: { ABS:1, OBLIQUES:0.5, ADDUCTORS:0.5 },
  DRAGON_FLAG_ECC: { ABS:1, OBLIQUES:0.5, LOWER_BACK:0.5 },
};

const MIN_SETS = 3, MAX_SETS = 15;
const BODY_FILL = '#e7e5e4';      // silhouette, and the stroke between muscles
const UNTRAINED_FILL = '#d1cdc9'; // present but under 3 sets

function computeVolume(days){
  const total = {}, optional = {};
  for (const d of days) for (const row of d.rows){
    if (!row.exId) continue;
    const isOpt = !!row.slot.optional || /optional/i.test(d.name || '');
    const map = EXERCISE_MUSCLES[row.exId] || PATTERN_MUSCLES[row.slot.pattern] || {};
    const sets = SETS[row.slot.pattern] || 3;
    for (const [m, w] of Object.entries(map)){
      total[m] = (total[m] || 0) + sets * w;
      if (isOpt) optional[m] = (optional[m] || 0) + sets * w;
    }
  }
  return { total, optional };
}

function fillFor(v){
  if (!v || v < MIN_SETS) return UNTRAINED_FILL;
  const t = Math.min(1, (v - MIN_SETS) / (MAX_SETS - MIN_SETS));
  const a = [254, 215, 170], b = [194, 65, 12];
  return `rgb(${a.map((x,i)=>Math.round(x+(b[i]-x)*t)).join(',')})`;
}

const ORDER = Object.keys(MUSCLE_LABEL);
const round1 = v => Math.round((v || 0) * 10) / 10;

function VolumeTracker({ prog }){
  const [hover, setHover] = useState(null);
  const { total, optional } = useMemo(() => computeVolume(prog.days), [prog]);
  const rows = ORDER.map(k => ({ k, v: round1(total[k]), o: round1(optional[k]) }))
                    .sort((a, b) => b.v - a.v);
  const trained = rows.filter(r => r.v >= MIN_SETS).length;

  const region = k => {
    const isDelt = k === 'FRONT_DELT' || k === 'SIDE_DELT';
    const paths = isDelt
      ? DELT_CAPS.map((c, i) => (
          <path key={i} d={c.d} clipPath={`url(#dc-${k === 'SIDE_DELT' ? 'o' : 'i'}${i})`} />
        ))
      : BODY_REGIONS[k].map((d, i) => <path key={i} d={d} />);
    return (
      <g key={k}
         fill={fillFor(total[k])}
         stroke={BODY_FILL} strokeWidth={1.4} strokeLinejoin="round"
         opacity={hover && hover !== k ? 0.35 : 1}
         onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
         style={{ transition: 'opacity .15s, fill .2s' }}>
        {paths}
        <title>{`${MUSCLE_LABEL[k]}: ${round1(total[k])} sets`}</title>
      </g>
    );
  };

  return (
    <div className="mt-6 border border-stone-200 rounded-xl overflow-hidden bg-white">
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50">
        <div className="text-sm font-semibold text-stone-900">Weekly volume by muscle</div>
        <div className="text-xs text-stone-500 mt-0.5">
          Weekly sets per muscle. {trained} of {ORDER.length} muscles at 3 or more sets.
        </div>
      </div>

      <div className="p-4">
        <svg viewBox={BODY_VIEWBOX} className="w-full h-auto block">
          <defs>
            {DELT_CAPS.map((c, i) => (
              <React.Fragment key={i}>
                <clipPath id={`dc-o${i}`}>
                  <rect x={c.outer[0]} y="0" width={c.outer[1]-c.outer[0]} height="648" />
                </clipPath>
                <clipPath id={`dc-i${i}`}>
                  <rect x={c.inner[0]} y="0" width={c.inner[1]-c.inner[0]} height="648" />
                </clipPath>
              </React.Fragment>
            ))}
          </defs>
          <g fill={BODY_FILL}>{BODY_BASE.map((d,i)=><path key={i} d={d} />)}</g>
          {ORDER.map(region)}
        </svg>
        <div className="flex justify-center gap-24 text-[10px] tracking-widest text-stone-400">
          <span>FRONT</span><span>BACK</span>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-1">
        {rows.map(({ k, v, o }) => {
          const dim = v < MIN_SETS;
          return (
            <div key={k} className="flex items-center gap-3 py-0.5"
                 onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:fillFor(v)}} />
              <span className={`w-24 text-xs flex-shrink-0 ${dim?'text-stone-400':'text-stone-700'}`}>
                {MUSCLE_LABEL[k]}
              </span>
              <span className="flex-1 h-1.5 bg-stone-100 rounded-full relative overflow-hidden">
                <span className="absolute left-0 top-0 h-full rounded-full"
                      style={{width:`${Math.min(100,(v/MAX_SETS)*100)}%`, background:fillFor(v)}} />
                {o > 0 && (
                  <span className="absolute top-0 h-full opacity-50"
                        style={{left:`${Math.min(100,((v-o)/MAX_SETS)*100)}%`,
                                width:`${Math.min(100,(o/MAX_SETS)*100)}%`,
                                background:'repeating-linear-gradient(45deg,#a8a29e,#a8a29e 2px,transparent 2px,transparent 4px)'}} />
                )}
              </span>
              <span className={`w-10 text-right text-xs tabular-nums ${dim?'text-stone-400':'text-stone-600'}`}>
                {v}
              </span>
            </div>
          );
        })}
      </div>

      <div className="px-4 pb-4 border-t border-stone-100 pt-3">
        <div className="text-xs font-semibold text-stone-700 mb-1.5">How the sets are counted</div>
        <p className="mt-2 text-xs text-stone-500 leading-relaxed">
          1 for primary, 0.5 for secondary and stabilisers:
        </p>
        <p className="text-xs text-stone-500 leading-relaxed">
          A set counts once for the muscle the exercise is built around, and for
          any muscle an isolation exercise targets directly. A supporting muscle
          gets half a set, so a set of bench press is one set of chest plus half a
          set each for triceps and front delts. Grip involvement on pulls, curls,
          shrugs and deadlifts counts a quarter set for forearms, since holding a
          bar is not the same stimulus as training them directly.
        </p>
        <p className="mt-2 text-xs text-stone-500 leading-relaxed">
          Counting supporting work at half a set is the method that best fit the
          data in Pelland et al., a meta-regression of 67 training studies. The
          alternatives were counting those sets in full or ignoring them entirely.
        </p>
        <p className="mt-2 text-xs text-stone-500 leading-relaxed">
          A muscle under 3 sets a week stays grey. Colour deepens to 15 sets.
          Hatched bar segments come from optional workouts.
        </p>
      </div>
    </div>
  );
}

function ReviewScreen({prog, owned, onSwapAt, onBack, onAccept}){
  const [swap, setSwap] = useState(null);
  const holes = prog.unserviceable;
  return (
    <>
      <Card className="max-w-2xl">
        <BackButton onClick={onBack} />
        <Eyebrow>Your program</Eyebrow>
        <h2 className="mt-3 text-2xl font-bold text-stone-900">{prog.name}</h2>
        <p className="mt-2 text-stone-600 text-sm leading-relaxed">
          The optimal split for you based on the equipment you have. If an exercise doesn't work for you
          (you can't do it, you don't like it, or it's never free when you train) hit Swap and pick
          another variation of the same movement. The exercises are listed in order of recommendation,
          so try to choose from the top of the list if possible.
        </p>

        <GapNotice holes={holes} />

        <div className="mt-6 space-y-6">
          {prog.days.map((d, di) => (
            <div key={di}>
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{d.name}</div>
              <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
                {d.rows.map((r, ri) => (
                  <ExerciseRow key={ri} row={r} onSwap={r.exId ? () => setSwap({di, ri}) : null} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <VolumeTracker prog={prog} />

        <PrimaryButton onClick={onAccept} className="mt-7">
          This is my program <ArrowRight className="w-4 h-4" />
        </PrimaryButton>
      </Card>

      {swap && (
        <SwapMenu row={prog.days[swap.di].rows[swap.ri]} prog={prog} di={swap.di} ri={swap.ri} owned={owned}
          onClose={() => setSwap(null)}
          onPick={id => { onSwapAt(swap.di, swap.ri, id); setSwap(null); }} />
      )}
    </>
  );
}

function FinalScreen({prog, seq, owned, onSwapAt, onInstructions, onRestart}){
  const [swap, setSwap] = useState(null);
  const [copied, setCopied] = useState(false);
  const code = encodeProgram(prog, seq);
  const copy = () => {
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <>
      <Card className="max-w-2xl">
        <Eyebrow>Done</Eyebrow>
        <h2 className="mt-3 text-2xl font-bold text-stone-900">Your program is ready.</h2>
        <p className="mt-2 text-stone-600 text-sm leading-relaxed">
          Send this code to Radu. He'll load your program into the ShredSmart app so you can start
          training and logging every set.
        </p>

        <div className="mt-6 bg-stone-900 rounded-xl p-5">
          <div className="text-xs text-stone-400 uppercase tracking-wider mb-2">Your OptiWorkout code</div>
          <div className="font-mono text-sm text-white break-all leading-relaxed">{code}</div>
          <button onClick={copy}
            className="mt-4 w-full bg-white hover:bg-stone-100 text-stone-900 font-medium py-2.5 px-4 rounded-full transition-colors flex items-center justify-center gap-2 text-sm">
            {copied ? <><Check className="w-4 h-4" /> Copied</> : <><Copy className="w-4 h-4" /> Copy code</>}
          </button>
        </div>

        <GapNotice holes={prog.unserviceable || []} />

        {seq > 1 && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-xl p-4">
            <p className="text-sm text-stone-700 leading-relaxed">
              <span className="font-semibold">This replaces your previous code.</span> Send Radu this one.
              Any earlier code no longer matches your program.
            </p>
          </div>
        )}

        <button onClick={onInstructions}
          className="mt-4 w-full bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl p-4 text-left transition-colors flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-stone-900">Read this before your first session</div>
            <div className="text-xs text-stone-500 mt-0.5">How to progress, how hard to push, how to warm up.</div>
          </div>
          <ArrowRight className="w-4 h-4 text-stone-400 flex-shrink-0" />
        </button>

        <div className="mt-6 space-y-6">
          {prog.days.map((d, di) => (
            <div key={di}>
              <div className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{d.name}</div>
              <div className="border border-stone-200 rounded-xl divide-y divide-stone-100">
                {d.rows.map((r, ri) => (
                  <ExerciseRow key={ri} row={r} detailed onSwap={r.exId ? () => setSwap({di, ri}) : null} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <VolumeTracker prog={prog} />

        <p className="mt-4 text-xs text-stone-500 leading-relaxed">
          RPT is Reverse Pyramid Training: heaviest set first, then drop the weight 5-10% each set.
          SS is Straight Sets: the same weight across all sets. RIR is reps in reserve — how many
          you should have left when you stop.
        </p>

        <button onClick={onRestart} className="mt-6 w-full text-sm text-stone-500 hover:text-stone-900 transition-colors">
          Start over
        </button>
      </Card>

      {swap && (
        <SwapMenu row={prog.days[swap.di].rows[swap.ri]} prog={prog} di={swap.di} ri={swap.ri} owned={owned}
          onClose={() => setSwap(null)}
          onPick={id => { onSwapAt(swap.di, swap.ri, id); setSwap(null); }} />
      )}
    </>
  );
}

function LoadCodeScreen({onBack, onLoaded}){
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const r = decodeProgram(code);
    if (!r.ok) return setError(r.error);
    onLoaded(r);
  };
  return (
    <Card className="max-w-xl">
      <BackButton onClick={onBack} />
      <Eyebrow>Reload a program</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">Paste an OptiWorkout code.</h2>
      <p className="mt-2 text-stone-600 text-sm leading-relaxed">
        It starts with OP1. Loading a code shows the full program and lets you swap any exercise.
      </p>
      <input value={code} onChange={e => { setCode(e.target.value); setError(''); }}
        onKeyDown={e => e.key === 'Enter' && submit()} placeholder="OP1-..."
        className="mt-6 w-full px-4 py-3.5 rounded-xl border border-stone-300 focus:border-orange-500 focus:outline-none font-mono text-sm" />
      {error && <p className="mt-3 text-sm text-orange-700 flex gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}</p>}
      <PrimaryButton onClick={submit} disabled={!code.trim()} className="mt-6">
        Load program <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
}

// ---- INSTRUCTIONS --------------------------------------------------
const Section = ({title, children}) => (
  <div className="mt-8 first:mt-0">
    <h3 className="text-lg font-bold text-stone-900">{title}</h3>
    <div className="mt-3 space-y-3 text-sm text-stone-600 leading-relaxed">{children}</div>
  </div>
);

const SetTable = ({rows, note}) => (
  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4">
    <div className="space-y-1 font-mono text-xs text-stone-800">
      {rows.map((r,i) => <div key={i}>{r}</div>)}
    </div>
    {note && <div className="mt-3 text-xs text-stone-600 leading-relaxed">{note}</div>}
  </div>
);

function InstructionsScreen({onBack}){
  return (
    <Card className="max-w-2xl">
      <BackButton onClick={onBack} />
      <Eyebrow>How to run this program</Eyebrow>
      <h2 className="mt-3 text-2xl font-bold text-stone-900">The progression is the program.</h2>
      <p className="mt-2 text-stone-600 text-sm leading-relaxed">
        The exercises matter less than what you do with them. Without progression there is no reason
        for your body to change. Read this once, properly, before your first session.
      </p>

      <Section title="Reverse Pyramid Training (RPT)">
        <p>
          On your compound lifts you perform your heaviest set first, while you're fresh, then reduce
          the weight 5-10% for each following set.
        </p>
        <SetTable rows={['Set 1:  60 kg × 8', 'Set 2:  57.5 kg × 8', 'Set 3:  55 kg × 8']} />
        <p>
          Take every set to 0-1 reps in reserve. In practice that means performing every rep you can.
          As fatigue builds, the weight drops just enough to keep you in the same rep range.
        </p>
        <p>
          If you kept the same weight across all sets, your reps would fall away, or you'd have to hold
          more back on the early sets. RPT keeps you inside the target range on every set, close to
          failure on every set, and avoids junk volume — sets too far from failure to do anything.
        </p>
      </Section>

      <Section title="Straight Sets (SS)">
        <p>
          On isolation exercises and smaller muscles that recover well between sets, you use the same
          load for all three sets. With RPT the weight would drop too far to be worth doing.
        </p>
        <SetTable
          rows={['Week 1:  10 kg × 12, 10, 9', 'Week 2:  10 kg × 12, 12, 11', 'Week 3:  10 kg × 12, 12, 12  → add weight']}
          note="Hold the load and build reps until you hit the top of the range in all three sets. Then increase." />
      </Section>

      <Section title="Multi-set double progression">
        <p>
          This is how you progress on everything, RPT or straight sets. Two steps, in order.
        </p>
        <p>
          <span className="font-semibold text-stone-900">One, build reps.</span> Hit the top of the rep
          range in every set.{' '}
          <span className="font-semibold text-stone-900">Two, add weight.</span> Only once you've hit
          the top in all sets, increase by the smallest increment available.
        </p>
        <SetTable
          rows={[
            'Workout 1:  60 × 7   57.5 × 7   55 × 8    → not yet',
            'Workout 2:  60 × 8   57.5 × 8   55 × 8    → add weight',
            'Workout 3:  62.5 × 7 60 × 7     57.5 × 7  → build again',
          ]}
          note="After a load increase your reps drop by one or two. That's expected. Build them back up to earn the next increase." />
        <p>
          This is not autoregulation. You are not training by feel. Before every set, check what you did
          last time and beat it. Track every rep of every set — without a log there is no progression.
        </p>
      </Section>

      <Section title="Dumbbell exercises progress differently">
        <p>
          Dumbbell movements carry wider rep ranges because you add weight to both hands at once, so
          each jump is a much larger percentage of the total load.
        </p>
        <SetTable
          rows={[
            'Workout 2:  30 × 10   27.5 × 10   25 × 10   → add weight',
            'Workout 3:  32.5 × 6  30 × 7      27.5 × 7',
          ]}
          note="Going up 2.5 kg per hand is a 5 kg jump, so expect to lose three or four reps rather than one or two. The wider range is there to absorb that." />
      </Section>

      <Section title="Warming up">
        <p>
          Before the first exercise for each muscle group, work up to your first working set. Three
          quick sets, minimal rest between them.
        </p>
        <SetTable
          rows={['5 reps  @ ~50% of working weight', '3 reps  @ ~75%', '2 reps  @ ~90%', '→ rest 2-3 min, then your first working set']}
          note="For later exercises hitting the same muscle you don't need to warm up again. For small isolation work, one set to feel the movement is enough." />
      </Section>

      <PrimaryButton onClick={onBack} className="mt-8">
        Back to my program <ArrowRight className="w-4 h-4" />
      </PrimaryButton>
    </Card>
  );
}

// =====================================================
// APP
// =====================================================
export default function App(){
  const [screen, setScreen] = useState('home');
  const [ss1, setSs1] = useState(null);
  const [days, setDays] = useState(null);
  const [skelId, setSkelId] = useState(null);
  const [owned, setOwned] = useState(new Set());
  const [prog, setProg] = useState(null);
  const [seq, setSeq] = useState(1);
  const [swapsMade, setSwapsMade] = useState(0);

  useEffect(() => {
    if (screen !== 'building') return;
    const t = setTimeout(() => setScreen('review'), 2000);
    return () => clearTimeout(t);
  }, [screen]);

  // PhysiquePlan can hand off directly with ?code=SS1-...
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('code');
    if (!p) return;
    const r = decodeSS1(p);
    if (r.ok){ setSs1(r); setScreen('ack'); }
  }, []);

  const totalSteps = 3;

  // A swap is a direct per-slot override. Ranges recompute for that day,
  // since the new exercise may carry different dumbbell / single-arm flags.
  const swapAt = (di, ri, newExId) => {
    const days2 = prog.days.map((d, i) => i !== di ? d : {
      ...d, rows: d.rows.map((r, j) => j !== ri ? r : { ...r, exId:newExId })
    });
    const counters = {};
    days2[di] = { ...days2[di], rows: days2[di].rows.map(r =>
      r.exId ? { ...r, range: computeRange(r.slot.pattern, r.exId, counters), rest: REST[r.slot.pattern] } : r) };
    setProg({ ...prog, days: days2 });
    if (screen === 'final') setSeq(seq + 1);
    setSwapsMade(swapsMade + 1);
  };

  const restart = () => {
    setScreen('home'); setSs1(null); setDays(null); setSkelId(null);
    setOwned(new Set()); setProg(null); setSeq(1); setSwapsMade(0);
  };

  let body;
  switch (screen){
    case 'home':
      body = <HomeScreen onContinue={() => setScreen('paste')} onCustom={() => setScreen('days')} onReload={() => setScreen('load')} />;
      break;
    case 'paste':
      body = <PasteCodeScreen onBack={() => setScreen('home')} onDecoded={r => { setSs1(r); setScreen('ack'); }} />;
      break;
    case 'ack':
      body = <AcknowledgeScreen ss1={ss1} onBack={() => setScreen('paste')} onContinue={() => setScreen('days')} />;
      break;
    case 'days':
      body = <DaysScreen step={0} total={totalSteps} onBack={() => setScreen(ss1 ? 'ack' : 'home')}
        onPick={n => {
          setDays(n);
          const opts = SKELETONS_BY_DAYS(n);
          if (opts.length === 1){ setSkelId(opts[0][0]); setScreen('equipment'); }
          else setScreen('split');
        }} />;
      break;
    case 'split':
      body = <SplitScreen days={days} step={1} total={totalSteps}
        onBack={() => setScreen('days')} onPick={id => { setSkelId(id); setScreen('equipment'); }} />;
      break;
    case 'equipment':
      body = <EquipmentScreen step={2} total={totalSteps} owned={owned} setOwned={setOwned}
        onBack={() => setScreen(SKELETONS_BY_DAYS(days).length > 1 ? 'split' : 'days')}
        onContinue={() => { setProg(buildProgram(skelId, owned, new Set())); setScreen('building'); }} />;
      break;
    case 'building':
      body = <LoadingScreen />;
      break;
    case 'review':
      body = <ReviewScreen prog={prog} owned={owned} onSwapAt={swapAt}
        onBack={() => setScreen('equipment')} onAccept={() => setScreen('final')} />;
      break;
    case 'final':
      body = <FinalScreen prog={prog} seq={seq} owned={owned} onSwapAt={swapAt}
        onInstructions={() => setScreen('instructions')} onRestart={restart} />;
      break;
    case 'instructions':
      body = <InstructionsScreen onBack={() => setScreen(prog ? 'final' : 'home')} />;
      break;
    case 'load':
      body = <LoadCodeScreen onBack={() => setScreen('home')}
        onLoaded={r => { setProg(r); setSkelId(r.skelId); setSeq(r.seq); setOwned(PRESET_FULL); setScreen('final'); }} />;
      break;
    default:
      body = <HomeScreen onContinue={() => setScreen('paste')} onCustom={() => setScreen('days')} onReload={() => setScreen('load')} />;
  }

  // centre the short screens; let the long program lists start at the top
  const centred = ['building','home','paste','load'].includes(screen);
  return <Shell center={centred}>{body}</Shell>;
}