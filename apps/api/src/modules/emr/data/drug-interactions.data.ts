/** Clinical decision support interaction database (allergy cross-reactivity + drug–drug). */
export interface DrugInteractionRule {
  id: string;
  type: 'allergy' | 'drug_drug';
  severity: 'high' | 'medium' | 'low';
  message: string;
  /** Substrings matched against medication names (lowercase). */
  drugs: string[];
  /** For allergy rules: allergen substring matched against patient allergies. */
  allergen?: string;
  /** RxNorm ingredient class hint for documentation. */
  source?: string;
}

export const DRUG_INTERACTION_DATABASE: DrugInteractionRule[] = [
  { id: 'allergy-penicillin', type: 'allergy', severity: 'high', allergen: 'penicillin', drugs: ['amoxicillin', 'ampicillin', 'piperacillin', 'penicillin', 'nafcillin'], message: 'Beta-lactam may cross-react with penicillin allergy', source: 'FDA' },
  { id: 'allergy-cephalo-penicillin', type: 'allergy', severity: 'medium', allergen: 'penicillin', drugs: ['cephalexin', 'cefazolin', 'ceftriaxone'], message: 'Cephalosporin use caution with penicillin allergy (cross-reactivity ~1–2%)', source: 'FDA' },
  { id: 'allergy-aspirin-nsaid', type: 'allergy', severity: 'high', allergen: 'aspirin', drugs: ['ibuprofen', 'naproxen', 'ketorolac', 'diclofenac', 'aspirin'], message: 'NSAID contraindicated with aspirin sensitivity', source: 'FDA' },
  { id: 'allergy-sulfa', type: 'allergy', severity: 'high', allergen: 'sulfa', drugs: ['sulfamethoxazole', 'trimethoprim', 'sulfasalazine', 'furosemide'], message: 'Sulfonamide-related drug with sulfa allergy', source: 'FDA' },
  { id: 'allergy-codeine-opioid', type: 'allergy', severity: 'high', allergen: 'codeine', drugs: ['morphine', 'hydrocodone', 'oxycodone', 'tramadol'], message: 'Opioid cross-sensitivity possible', source: 'FDA' },
  { id: 'allergy-latex', type: 'allergy', severity: 'medium', allergen: 'latex', drugs: ['amoxicillin', 'ceftriaxone'], message: 'Some antibiotics packaged with latex — verify supply', source: 'clinical' },
  { id: 'dd-warfarin-nsaid', type: 'drug_drug', severity: 'high', drugs: ['warfarin', 'ibuprofen'], message: 'NSAID + anticoagulant: increased GI bleeding risk', source: 'Lexicomp' },
  { id: 'dd-warfarin-aspirin', type: 'drug_drug', severity: 'high', drugs: ['warfarin', 'aspirin'], message: 'Antiplatelet + anticoagulant: major bleeding risk', source: 'Lexicomp' },
  { id: 'dd-warfarin-fluconazole', type: 'drug_drug', severity: 'high', drugs: ['warfarin', 'fluconazole'], message: 'Fluconazole inhibits warfarin metabolism — monitor INR', source: 'Lexicomp' },
  { id: 'dd-methotrexate-nsaid', type: 'drug_drug', severity: 'high', drugs: ['methotrexate', 'ibuprofen'], message: 'NSAID may reduce methotrexate clearance — toxicity risk', source: 'Lexicomp' },
  { id: 'dd-methotrexate-trimethoprim', type: 'drug_drug', severity: 'high', drugs: ['methotrexate', 'trimethoprim'], message: 'Trimethoprim increases methotrexate toxicity', source: 'Lexicomp' },
  { id: 'dd-lisinopril-potassium', type: 'drug_drug', severity: 'medium', drugs: ['lisinopril', 'potassium'], message: 'ACE inhibitor + potassium supplement: hyperkalemia risk', source: 'Lexicomp' },
  { id: 'dd-lisinopril-spironolactone', type: 'drug_drug', severity: 'medium', drugs: ['lisinopril', 'spironolactone'], message: 'ACE inhibitor + K-sparing diuretic: hyperkalemia', source: 'Lexicomp' },
  { id: 'dd-simvastatin-clarithromycin', type: 'drug_drug', severity: 'high', drugs: ['simvastatin', 'clarithromycin'], message: 'CYP3A4 inhibitor increases statin myopathy risk', source: 'Lexicomp' },
  { id: 'dd-simvastatin-amlodipine', type: 'drug_drug', severity: 'medium', drugs: ['simvastatin', 'amlodipine'], message: 'Amlodipine increases simvastatin exposure — limit dose', source: 'Lexicomp' },
  { id: 'dd-metformin-contrast', type: 'drug_drug', severity: 'medium', drugs: ['metformin', 'contrast'], message: 'Hold metformin around iodinated contrast (lactic acidosis risk)', source: 'ACR' },
  { id: 'dd-ssri-tramadol', type: 'drug_drug', severity: 'high', drugs: ['sertraline', 'tramadol'], message: 'Serotonin syndrome risk: SSRI + tramadol', source: 'Lexicomp' },
  { id: 'dd-ssri-maoi', type: 'drug_drug', severity: 'high', drugs: ['sertraline', 'phenelzine'], message: 'SSRI + MAOI: contraindicated (serotonin syndrome)', source: 'FDA' },
  { id: 'dd-lithium-nsaid', type: 'drug_drug', severity: 'high', drugs: ['lithium', 'ibuprofen'], message: 'NSAID increases lithium levels — monitor serum lithium', source: 'Lexicomp' },
  { id: 'dd-digoxin-amiodarone', type: 'drug_drug', severity: 'high', drugs: ['digoxin', 'amiodarone'], message: 'Amiodarone increases digoxin levels — reduce digoxin dose', source: 'Lexicomp' },
  { id: 'dd-clopidogrel-omeprazole', type: 'drug_drug', severity: 'medium', drugs: ['clopidogrel', 'omeprazole'], message: 'Omeprazole may reduce clopidogrel activation', source: 'FDA' },
  { id: 'dd-levothyroxine-calcium', type: 'drug_drug', severity: 'medium', drugs: ['levothyroxine', 'calcium'], message: 'Calcium reduces levothyroxine absorption — separate by 4h', source: 'Lexicomp' },
  { id: 'dd-levothyroxine-iron', type: 'drug_drug', severity: 'medium', drugs: ['levothyroxine', 'iron'], message: 'Iron reduces levothyroxine absorption — separate dosing', source: 'Lexicomp' },
  { id: 'dd-qt-azithromycin', type: 'drug_drug', severity: 'medium', drugs: ['azithromycin', 'ondansetron'], message: 'Both prolong QT — monitor ECG', source: 'Lexicomp' },
  { id: 'dd-qt-haloperidol', type: 'drug_drug', severity: 'high', drugs: ['haloperidol', 'ondansetron'], message: 'Additive QT prolongation risk', source: 'Lexicomp' },
  { id: 'dd-insulin-beta-blocker', type: 'drug_drug', severity: 'medium', drugs: ['insulin', 'propranolol'], message: 'Non-selective beta-blocker may mask hypoglycemia symptoms', source: 'Lexicomp' },
  { id: 'dd-prednisone-insulin', type: 'drug_drug', severity: 'medium', drugs: ['prednisone', 'insulin'], message: 'Corticosteroid increases insulin requirements', source: 'clinical' },
  { id: 'dd-ciprofloxacin-theophylline', type: 'drug_drug', severity: 'high', drugs: ['ciprofloxacin', 'theophylline'], message: 'Fluoroquinolone inhibits theophylline clearance', source: 'Lexicomp' },
  { id: 'dd-phenytoin-oral-contraceptive', type: 'drug_drug', severity: 'medium', drugs: ['phenytoin', 'ethinyl estradiol'], message: 'Enzyme inducer reduces contraceptive efficacy', source: 'Lexicomp' },
  { id: 'dd-rifampin-warfarin', type: 'drug_drug', severity: 'high', drugs: ['rifampin', 'warfarin'], message: 'Rifampin induces warfarin metabolism — INR may drop', source: 'Lexicomp' },
  { id: 'dd-amiodarone-warfarin', type: 'drug_drug', severity: 'high', drugs: ['amiodarone', 'warfarin'], message: 'Amiodarone inhibits warfarin metabolism — reduce warfarin dose', source: 'Lexicomp' },
  { id: 'dd-gemfibrozil-statin', type: 'drug_drug', severity: 'high', drugs: ['gemfibrozil', 'simvastatin'], message: 'Fibrate + statin: rhabdomyolysis risk', source: 'FDA' },
  { id: 'dd-potassium-sparing-duo', type: 'drug_drug', severity: 'high', drugs: ['spironolactone', 'triamterene'], message: 'Dual K-sparing agents: severe hyperkalemia risk', source: 'Lexicomp' },
  { id: 'dd-ace-arb', type: 'drug_drug', severity: 'high', drugs: ['lisinopril', 'losartan'], message: 'ACE inhibitor + ARB: avoid dual RAAS blockade', source: 'FDA' },
  { id: 'dd-triple-therapy', type: 'drug_drug', severity: 'medium', drugs: ['aspirin', 'clopidogrel', 'warfarin'], message: 'Triple antithrombotic therapy: elevated bleeding risk', source: 'ACC' },
  { id: 'dd-alcohol-opioid', type: 'drug_drug', severity: 'high', drugs: ['oxycodone', 'alcohol'], message: 'CNS depression: opioid + alcohol', source: 'FDA' },
  { id: 'dd-alcohol-benzodiazepine', type: 'drug_drug', severity: 'high', drugs: ['diazepam', 'alcohol'], message: 'Respiratory depression risk: benzodiazepine + alcohol', source: 'FDA' },
  { id: 'dd-fluoroquinolone-steroid', type: 'drug_drug', severity: 'medium', drugs: ['ciprofloxacin', 'prednisone'], message: 'Fluoroquinolone + steroid: tendon rupture risk (especially elderly)', source: 'FDA' },
  { id: 'dd-tetracycline-dairy', type: 'drug_drug', severity: 'low', drugs: ['doxycycline', 'calcium'], message: 'Divalent cations reduce tetracycline absorption', source: 'Lexicomp' },
  { id: 'dd-metoclopramide-antipsychotic', type: 'drug_drug', severity: 'high', drugs: ['metoclopramide', 'haloperidol'], message: 'Additive extrapyramidal symptoms and QT prolongation', source: 'Lexicomp' },
];

export interface DrugInteractionWarning {
  id: string;
  severity: 'high' | 'medium' | 'low';
  type: 'allergy' | 'drug_drug';
  message: string;
  source?: string;
  drugsInvolved: string[];
}

export function checkDrugInteractionDatabase(
  medications: string[],
  allergies: string[] = [],
): DrugInteractionWarning[] {
  const medLower = medications.map((m) => m.toLowerCase()).filter(Boolean);
  const allergyLower = allergies.map((a) => a.toLowerCase());
  const warnings: DrugInteractionWarning[] = [];
  const seen = new Set<string>();

  for (const rule of DRUG_INTERACTION_DATABASE) {
    if (rule.type === 'allergy') {
      if (!rule.allergen || !allergyLower.some((a) => a.includes(rule.allergen!))) continue;
      const matched = medLower.filter((m) => rule.drugs.some((d) => m.includes(d)));
      if (!matched.length) continue;
      const key = `${rule.id}:${matched.join(',')}`;
      if (seen.has(key)) continue;
      seen.add(key);
      warnings.push({
        id: rule.id,
        severity: rule.severity,
        type: 'allergy',
        message: rule.message,
        source: rule.source,
        drugsInvolved: matched,
      });
      continue;
    }

    const matched = rule.drugs.filter((d) => medLower.some((m) => m.includes(d)));
    if (rule.drugs.length >= 2) {
      const allPresent = rule.drugs.every((d) => medLower.some((m) => m.includes(d)));
      if (!allPresent) continue;
    } else if (!matched.length) {
      continue;
    }

    const key = rule.id;
    if (seen.has(key)) continue;
    seen.add(key);
    warnings.push({
      id: rule.id,
      severity: rule.severity,
      type: 'drug_drug',
      message: rule.message,
      source: rule.source,
      drugsInvolved: rule.drugs,
    });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  return warnings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
