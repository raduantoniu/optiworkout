import React, { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check, Copy, X, AlertTriangle, BookOpen } from 'lucide-react';

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
  RACK:'squat rack', FLAT_BENCH:'flat bench', ADJ_BENCH:'adjustable bench',
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
  SEAL_BENCH:'seal row bench', PULLDOWN_M:'lat pulldown machine (lever)',
  SHRUG_M:'shrug machine', HIP_THRUST_M:'hip thrust machine', HIP_THRUST_STATION:'hip thrust station',
  ROMAN_CHAIR:'roman chair', CRUNCH_M:'abs crunch machine', CAPTAINS_CHAIR:"captain's chair",
  HEAD_HARNESS:'head harness', PLATE:'weight plate',
};

// =====================================================
// EXERCISE LIBRARY
// id: [display name, [equipment...], {flags}]
// flags — db: dumbbell (widens range to span 4), sa: single-arm (+2 on
// compounds only), amrap: no prescribed range
// =====================================================
const EXERCISES = {
  // SQUAT
  HACK_SQUAT:['Hack Squat',[EQ.HACK]],
  PENDULUM_SQUAT:['Pendulum Squat',[EQ.PENDULUM]],
  LEG_PRESS:['Leg Press',[EQ.LEG_PRESS_M]],
  SQUAT_SMITH:['Smith Machine Squat',[EQ.SMITH]],
  SQUAT_BACK:['Back Squat',[EQ.BARBELL,EQ.RACK]],
  SQUAT_FRONT:['Front Squat',[EQ.BARBELL,EQ.RACK]],
  SPLIT_SQUAT_BULG:['Bulgarian Split Squat',[EQ.DUMBBELLS],{db:true}],
  // HINGE
  RDL_LEVER:['Romanian Deadlift (Lever Arms)',[EQ.LEVER_ARMS]],
  RDL_TRAP:['Romanian Deadlift (Trap Bar)',[EQ.TRAP_BAR]],
  BACK_EXT_WTD:['Weighted Back Extension',[EQ.ROMAN_CHAIR,EQ.PLATE]],
  RDL_LANDMINE:['Romanian Deadlift (Landmine)',[EQ.LANDMINE,EQ.BARBELL]],
  RDL_SMITH:['Romanian Deadlift (Smith)',[EQ.SMITH]],
  RDL_BB:['Romanian Deadlift (Barbell)',[EQ.BARBELL]],
  RDL_CABLE:['Romanian Deadlift (Cable)',[EQ.CABLE]],
  RDL_DB:['Romanian Deadlift (Dumbbell)',[EQ.DUMBBELLS],{db:true}],
  // GLUTE
  HIP_THRUST_BB:['Barbell Hip Thrust (Hip Thrust Station)',[EQ.HIP_THRUST_STATION,EQ.BARBELL]],
  HIP_THRUST_MACH:['Hip Thrust (Machine)',[EQ.HIP_THRUST_M]],
  HIP_THRUST_SMITH:['Hip Thrust (Smith Machine)',[EQ.SMITH,EQ.FLAT_BENCH]],
  HIP_THRUST_BENCH:['Barbell Hip Thrust (Bench Propped, Manual Setup)',[EQ.BARBELL,EQ.FLAT_BENCH]],
  HIP_THRUST_DB_1L:['Single-Leg Hip Thrust (Dumbbell)',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{db:true,sa:true}],
  // LEG_EXT
  LEG_EXT:['Leg Extension',[EQ.LEG_EXT_M]],
  REVERSE_NORDIC:['Band-Assisted Reverse Nordic Curl',[EQ.BANDS]],
  SISSY_SQUAT:['Sissy Squat',[]],
  // LEG_CURL
  LEG_CURL_SEATED:['Seated Leg Curl',[EQ.LEG_CURL_SEATED_M]],
  LEG_CURL_LYING:['Lying Leg Curl',[EQ.LEG_CURL_LYING_M]],
  LEG_CURL_KNEELING:['Kneeling Leg Curl (Machine)',[EQ.LEG_CURL_KNEELING_M]],
  NORDIC_BAND:['Band-Assisted Nordic Curl',[EQ.BANDS]],
  // CALF
  CALF_STRAIGHT_M:['Seated Straight-Leg Calf Raise (Machine)',[EQ.CALF_SEATED_STRAIGHT_M]],
  CALF_STANDING_MACH:['Standing Calf Raise (Machine)',[EQ.CALF_STANDING_M]],
  CALF_STANDING_CABLE:['Standing Calf Raise (Cable)',[EQ.CABLE,EQ.STEPPER]],
  CALF_STRAIGHT_SM:['Straight Leg Calf Raise (Smith)',[EQ.SMITH,EQ.STEPPER]],
  CALF_STRAIGHT_DB:['Straight Leg Calf Raise (DB)',[EQ.DUMBBELLS,EQ.STEPPER],{db:true}],
  CALF_SEATED:['Seated Calf Raise',[EQ.CALF_SEATED_M]],
  CALF_SL_BW:['Single-Leg Calf Raise (Bodyweight)',[],{sa:true}],
  // INCLINE_PRESS
  INC_BB_30:['30° Incline Barbell Press',[EQ.BARBELL,EQ.INCLINE_STATION]],
  INC_BB_15:['15° Incline Barbell Press',[EQ.BARBELL,EQ.RACK,EQ.ADJ_BENCH]],
  INC_DB_30:['30° Incline Dumbbell Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  INC_DB_15:['15° Incline Dumbbell Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  INC_PRESS_MACH:['Incline Chest Press (Plate-Loaded)',[EQ.INCLINE_PRESS_M]],
  INC_PRESS_MACH_STACK:['Incline Chest Press (Stack-Loaded)',[EQ.INCLINE_PRESS_M]],
  INC_PRESS_SMITH:['Smith Machine Incline Bench Press',[EQ.SMITH,EQ.ADJ_BENCH]],
  // FLAT_PRESS
  BENCH_BB:['Barbell Bench Press',[EQ.BARBELL,EQ.RACK,EQ.FLAT_BENCH]],
  CHEST_PRESS_MACH:['Vertical Chest Press (Machine)',[EQ.CHEST_PRESS_M]],
  CHEST_PRESS_FLAT_MACH:['Flat Chest Press (Machine)',[EQ.CHEST_PRESS_M]],
  CHEST_PRESS_NEUTRAL_MACH:['Chest Press (Machine, Neutral Grip)',[EQ.CHEST_PRESS_M]],
  BENCH_SMITH:['Flat Bench Press (Smith Machine)',[EQ.SMITH,EQ.FLAT_BENCH]],
  BENCH_DB_FLAT:['Flat Dumbbell Bench Press',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{db:true}],
  // CHEST_ISO
  DB_FLY_PRESS:['DB Fly-Press',[EQ.DUMBBELLS,EQ.FLAT_BENCH],{db:true}],
  DB_FLY_PRESS_INC:['Incline DB Fly-Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  PEC_DECK:['Pec Deck',[EQ.PEC_DECK]],
  CHEST_FLY_MACH:['Chest Fly (Plate-Loaded)',[EQ.CHEST_FLY_M]],
  CHEST_FLY_MACH_STACK:['Chest Fly (Stack-Loaded)',[EQ.CHEST_FLY_M]],
  CHEST_FLY_CABLE:['Seated Cable Fly',[EQ.CABLE,EQ.ADJ_BENCH]],
  CHEST_FLY_CABLE_STAND:['Standing Cable Fly',[EQ.CABLE]],
  // VERT_PUSH
  SHLDR_PRESS_DB:['Seated DB Shoulder Press',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  VIKING_PRESS:['Viking Shoulder Press',[EQ.VIKING]],
  SHLDR_PRESS_MACH:['Shoulder Press (Plate-Loaded)',[EQ.SHOULDER_PRESS_M]],
  SHLDR_PRESS_MACH_STACK:['Shoulder Press (Stack-Loaded)',[EQ.SHOULDER_PRESS_M]],
  OHP_BB:['Standing Overhead Press',[EQ.BARBELL,EQ.RACK]],
  SHLDR_PRESS_SMITH:['Seated Shoulder Press (Smith)',[EQ.SMITH,EQ.ADJ_BENCH]],
  SHLDR_PRESS_DB_1A:['Standing One-Arm DB Press',[EQ.DUMBBELLS],{db:true,sa:true}],
  // HORIZ_PULL
  ROW_TBAR_CS:['Chest-Supported T-Bar Row',[EQ.TBAR_M]],
  ROW_CS_MACH:['Chest-Supported Row (Plate-Loaded)',[EQ.ROW_CS_M]],
  ROW_CS_MACH_STACK:['Chest-Supported Row (Stack-Loaded)',[EQ.ROW_CS_M]],
  ROW_SEAL:['Seal Row (Barbell)',[EQ.SEAL_BENCH,EQ.BARBELL]],
  ROW_CABLE_SEATED:['Seated Cable Row',[EQ.CABLE]],
  ROW_CABLE_CS_1A:['Single-Arm Chest-Supported Cable Row',[EQ.CABLE,EQ.ADJ_BENCH],{sa:true}],
  ROW_CABLE_CS:['Chest-Supported Row (Cable)',[EQ.CABLE,EQ.ADJ_BENCH]],
  ROW_PENDLAY:['Pendlay Row',[EQ.BARBELL]],
  ROW_DB_CS:['Chest-Supported Dumbbell Row',[EQ.DUMBBELLS,EQ.ADJ_BENCH],{db:true}],
  ROW_DB_1A:['Single-Arm Dumbbell Row',[EQ.DUMBBELLS],{db:true,sa:true}],
  ROW_INVERTED:['Feet-Elevated Inverted Row',[EQ.BARBELL,EQ.RACK],{amrap:true}],
  // VERT_PULL
  PULLUP_NEUTRAL_W:['Weighted Neutral-Grip Pull-up',[EQ.NEUTRAL_BARS,EQ.WEIGHT_BELT]],
  CHINUP_W:['Weighted Chin-up',[EQ.PULLUP_BAR,EQ.WEIGHT_BELT]],
  PULLUP_W:['Weighted Pull-up',[EQ.PULLUP_BAR,EQ.WEIGHT_BELT]],
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
  TRAPS:['SHRUG_MACH','SHRUG_SMITH','SHRUG_TRAP','SHRUG_DB','SHRUG_KELSO'],
  SIDE_DELT:['LAT_RAISE_MACH','CUBAN_PRESS','LAT_RAISE_DB','LAT_RAISE_CBL_BTB','LAT_RAISE_CABLE'],
  REAR_DELT:['REAR_DELT_MACH','REAR_DELT_CBL_1A','FACE_PULL_CABLE','REAR_DELT_DB_30'],
  TRI_OH:['TRI_OH_CABLE','TRI_OH_CABLE_1A','SKULLCRUSHER_BB','TRI_OH_DB','TRI_OH_DB_INC'],
  TRI_PUSHDOWN:['TRI_PUSHDOWN','TRI_PUSHDOWN_1A'],
  BICEPS:['CURL_INCLINE_DB','CURL_BAYESIAN','CURL_EZ','CURL_BB','CURL_DB_STANDING'],
  ABS:['CRUNCH_MACH','CRUNCH_CABLE','LEG_RAISE_LYING','LEG_RAISE_CHAIR','DRAGON_FLAG_ECC'],
  NECK:['NECK_CURL_PLATE','NECK_EXT_PLATE','NECK_CURL_CABLE','NECK_EXT_PLATE_ST','NECK_CURL_SEATED_CABLE','NECK_EXT_SEATED_CABLE','NECK_CURL_INCLINE','NECK_EXT_INCLINE'],
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
  TRI_PUSHDOWN:'Triceps pushdown', BICEPS:'Biceps', ABS:'Abs', NECK:'Neck',
};

// =====================================================
// RESOLVER
// =====================================================
function canEquip(exId, owned){ return EXERCISES[exId][1].every(r => owned.has(r)); }

function resolveSlot(pattern, owned, vetoed, usedThisWeek){
  const ok = (id,{allowRepeat=false}={}) => {
    if (vetoed.has(id)) return false;
    if (!canEquip(id,owned)) return false;
    if (!allowRepeat && usedThisWeek.has(id)) return false;
    return true;
  };
  const scan = (list,opts) => { for (const id of list) if (ok(id,opts)) return id; return null; };
  const own = POOLS[pattern];
  const fb = POOL_FALLBACK[pattern] ? POOLS[POOL_FALLBACK[pattern]] : [];
  return scan(own,{}) || scan(fb,{}) || scan(own,{allowRepeat:true}) || scan(fb,{allowRepeat:true}) || null;
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
  CALF:[15,20], ABS:[10,12], NECK:[15,20], GLUTE:[8,12], TRAPS:[10,15],
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
  BICEPS:'1-2 min', ABS:'1-2 min', NECK:'1 min',
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
  ABS:'SS', NECK:'SS',
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
    { name:'Lower 1', slots:[S('SQUAT'),S('HINGE'),S('CALF'),S('NECK',{optional:true}),S('NECK',{optional:true})] },
    { name:'Upper 1', slots:[S('FLAT_PRESS'),S('HORIZ_PULL'),S('VERT_PUSH'),S('VERT_PULL'),S('BICEPS'),S('TRI_PUSHDOWN'),S('REAR_DELT')] },
    { name:'Lower 2', slots:[S('GLUTE'),S('SQUAT'),S('LEG_CURL'),S('LEG_EXT'),S('CALF'),S('ABS')] },
    { name:'Upper 2', slots:[S('VERT_PULL'),S('INCLINE_PRESS'),S('HORIZ_PULL'),S('FLAT_PRESS'),S('TRAPS'),S('BICEPS'),S('TRI_OH'),S('SIDE_DELT')] },
  ], dayCount:4, blurb:'Everything twice a week, split cleanly down the middle.' },

  PPLU:{ name:'Push / Pull / Legs / Upper', days:[
    { name:'Push',  slots:[S('INCLINE_PRESS'),S('FLAT_PRESS'),S('TRI_OH'),S('SIDE_DELT'),S('ABS')] },
    { name:'Pull',  slots:[S('VERT_PULL'),S('HORIZ_PULL'),S('BICEPS'),S('REAR_DELT'),S('NECK',{optional:true}),S('NECK',{optional:true})] },
    { name:'Legs',  slots:[S('SQUAT'),S('HINGE'),S('LEG_EXT'),S('LEG_CURL'),S('CALF')] },
    { name:'Upper', slots:[S('TRAPS'),S('VERT_PUSH'),S('VERT_PULL'),S('FLAT_PRESS'),S('BICEPS'),S('TRI_PUSHDOWN')] },
  ], dayCount:4, blurb:'Classic push/pull/legs with an extra upper day to lift torso frequency.' },

  PPLE:{ name:'Push / Pull, Legs Every Session', days:[
    { name:'Day 1', slots:[S('HINGE'),S('FLAT_PRESS'),S('VERT_PUSH'),S('CHEST_ISO'),S('TRI_OH'),S('NECK',{optional:true}),S('NECK',{optional:true})] },
    { name:'Day 2', slots:[S('SQUAT'),S('VERT_PULL'),S('HORIZ_PULL'),S('BICEPS'),S('REAR_DELT'),S('CALF')] },
    { name:'Day 3', slots:[S('SQUAT'),S('INCLINE_PRESS'),S('VERT_PUSH'),S('FLAT_PRESS'),S('TRI_PUSHDOWN'),S('SIDE_DELT')] },
    { name:'Day 4', slots:[S('VERT_PULL'),S('HORIZ_PULL'),S('TRAPS'),S('BICEPS'),S('LEG_CURL'),S('LEG_EXT'),S('CALF')] },
  ], dayCount:4, blurb:'Push and pull upper work, with leg training spread across every session instead of stacked into one.' },

  D5:{ name:'Lower / Torso / Arms / Lower / Upper', days:[
    { name:'Lower 1', slots:[S('SQUAT'),S('HINGE'),S('LEG_EXT'),S('CALF'),S('ABS')] },
    { name:'Torso',   slots:[S('INCLINE_PRESS'),S('HORIZ_PULL'),S('CHEST_ISO'),S('VERT_PULL'),S('REAR_DELT')] },
    { name:'Arms',    slots:[S('VERT_PUSH'),S('BICEPS'),S('TRI_OH'),S('BICEPS'),S('TRI_PUSHDOWN'),S('SIDE_DELT')] },
    { name:'Lower 2', slots:[S('GLUTE'),S('SQUAT'),S('LEG_CURL'),S('ABS'),S('NECK',{optional:true}),S('NECK',{optional:true})] },
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
  const usedThisWeek = new Set();
  const unserviceable = [];
  const days = skel.days.map(day => {
    const counters = {};
    const rows = day.slots.map(slot => {
      const exId = resolveSlot(slot.pattern, owned, vetoed, usedThisWeek);
      if (!exId){ unserviceable.push(slot.pattern); return {slot, exId:null, range:null, rest:null}; }
      usedThisWeek.add(exId);
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
const PRESET_MID = new Set([
  EQ.BARBELL,EQ.DUMBBELLS,EQ.EZ_BAR,EQ.RACK,EQ.FLAT_BENCH,EQ.ADJ_BENCH,EQ.INCLINE_STATION,
  EQ.CABLE,EQ.LAT_PULLDOWN,EQ.PULLUP_BAR,EQ.WEIGHT_BELT,EQ.SMITH,EQ.LEG_PRESS_M,EQ.LEG_EXT_M,
  EQ.LEG_CURL_SEATED_M,EQ.CALF_STANDING_M,EQ.CALF_SEATED_STRAIGHT_M,EQ.CHEST_PRESS_M,EQ.PEC_DECK,EQ.SHOULDER_PRESS_M,
  EQ.LAT_RAISE_M,EQ.REAR_DELT_M,EQ.ROW_CS_M,EQ.CRUNCH_M,EQ.STEPPER,EQ.PLATE,EQ.BANDS,
]);
const PRESET_GARAGE = new Set([
  EQ.BARBELL,EQ.DUMBBELLS,EQ.RACK,EQ.FLAT_BENCH,EQ.ADJ_BENCH,EQ.PULLUP_BAR,
  EQ.WEIGHT_BELT,EQ.PLATE,EQ.STEPPER,EQ.BANDS,
]);

// =====================================================
// UI PRIMITIVES — matched to the ShredSmart suite
// =====================================================
const Shell = ({children}) => (
  <div className="min-h-screen bg-stone-50 flex flex-col">
    <header className="w-full px-6 py-4 flex items-center justify-between border-b border-stone-200 bg-white">
      <span className="font-semibold text-stone-900 tracking-tight">ShredSmart™</span>
      <span className="text-xs text-stone-500 tracking-wider">OptiWorkout™</span>
    </header>
    <main className="flex-1 flex items-start justify-center px-4 py-8">{children}</main>
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
const ExerciseImage = ({exId, className=''}) => {
  const [failed, setFailed] = useState(false);
  const name = EXERCISES[exId][0];
  if (failed) return (
    <div className={`rounded-lg border border-stone-200 bg-stone-100 aspect-[2/1] ${className}`} />
  );
  return (
    <div className={`rounded-lg overflow-hidden bg-stone-100 border border-stone-200 ${className}`}>
      <img src={imageFor(exId)} alt={name} onError={() => setFailed(true)}
        className="w-full aspect-[2/1] object-cover" />
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
        <button onClick={() => preset(PRESET_FULL)} className="px-4 py-2 rounded-full bg-stone-100 hover:bg-stone-200 text-sm font-medium text-stone-800 transition-colors">Full commercial gym</button>
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
        <ExerciseImage exId={id} className="w-28 flex-shrink-0" />
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
      <ExerciseImage exId={row.exId} className="w-24 sm:w-32 flex-shrink-0" />
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

        {holes.length > 0 && (
          <div className="mt-5 bg-orange-50 border border-orange-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-stone-700 leading-relaxed">
              Your setup can't cover {holes.map(h => (PATTERN_LABEL[h]||h).toLowerCase()).join(' or ')}.
              The program runs without it. Everything else is covered.
            </p>
          </div>
        )}

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
        onContinue={() => { setProg(buildProgram(skelId, owned, new Set())); setScreen('review'); }} />;
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

  return <Shell>{body}</Shell>;
}