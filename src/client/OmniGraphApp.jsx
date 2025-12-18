import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Settings, GitBranch, Terminal, CheckCircle, XCircle, ChevronDown, Plus, Trash2, Loader, Save, Code, Zap, RefreshCw } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

// --- CONFIGURATION & DATA MOCKS ---

// Global variables provided by the environment (MANDATORY USE)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
// FIX: Correctly reference the global __initial_auth_token variable.
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null; 

const colors = {
  dark: '#1e1b4b',   // Indigo 950
  primary: '#4f46e5', // Indigo 600
  accent: '#06b6d4',  // Cyan 500
  hot: '#f43f5e',     // Rose 500
  light: '#f8fafc',   // Slate 50
};

const mockSources = [
  'product.metafields.custom.isbn',
  'product.metafields.custom.fabric_type',
  'product.tags',
  'product.vendor',
  'review_count',
  'average_rating',
  'inventory_quantity',
  'current_price'
];

const mockTargets = [
  'identifier',
  'material',
  'keywords',
  'manufacturer',
  'review', // The complex one
  'availability',
  'price'
];

const mockOperators = ['>', '<', '==', '!=', 'contains', 'is empty'];

const defaultMappings = [
  { 
    id: 1, 
    source: 'product.metafields.custom.isbn', 
    target: 'identifier', 
    type: 'Text', 
    conditions: [] 
  },
  { 
    id: 2, 
    source: 'average_rating', 
    target: 'review', 
    type: 'Condition', 
    conditions: [
        { field: 'review_count', operator: '>', value: 5, logic: 'AND' },
        { field: 'average_rating', operator: '>', value: 4.5, logic: 'END' }
    ]
  },
];

// --- CORE LOGIC: SCHEMA GENERATION & PARSING ---

// Function to generate JSON-LD from structured Mappings (Mapper -> Code)
const generateJsonLd = (mappings) => {
  const productSchema = {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "OmniGraph Pro Widget",
    "description": "A fully customized, SEO-optimized product.",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": "99.99"
    }
  };

  mappings.forEach(mapping => {
    let value = mapping.source ? `[${mapping.source}]` : '';
    
    if (mapping.target === 'review' && mapping.type === 'Condition' && mapping.conditions.length > 0) {
        // Build the DSI conditional rule string for backend parsing
        const ruleString = mapping.conditions.map((c, index) => {
            let logic = index === mapping.conditions.length - 1 ? 'END' : 'AND';
            return `${c.field} ${c.operator} ${c.value} ${logic === 'END' ? '' : logic}`;
        }).join(' ');

        productSchema['review'] = { 
            "@type": "AggregateRating",
            "ratingValue_Rule": `IF (${ruleString}) THEN ${value} ELSE [NULL]`,
        };
        productSchema[`_comment_rule_${mapping.id}`] = `// Mapped to review with ${mapping.conditions.length} condition(s).`;

    } else if (mapping.target && mapping.source) {
      productSchema[mapping.target] = value;
      productSchema[`_comment_id_${mapping.id}`] = `// Mapped via OmniGraph Node ID ${mapping.id}`;
    }
  });

  return JSON.stringify(productSchema, null, 2);
};

// Function to parse raw JSON-LD back into structured Mappings (Code -> Mapper)
const parseJsonToMappings = (jsonString) => {
    let newMappings = [];
    let nextId = 1;
    
    try {
        const json = JSON.parse(jsonString);
        
        for (const key in json) {
            if (key.startsWith('@') || key.startsWith('_comment')) continue;

            const value = json[key];

            // 1. Check for Standard Mapping (Placeholder Value)
            if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
                const source = value.slice(1, -1);
                
                // Skip if this target is handled by conditional logic
                if (key === 'review' && typeof json['review'] === 'object' && json['review'].ratingValue_Rule) continue;
                
                newMappings.push({
                    id: nextId++,
                    source: source,
                    target: key,
                    type: 'Text',
                    conditions: []
                });
            }

            // 2. Check for Conditional Mapping (Specific Structure: 'review')
            if (key === 'review' && typeof value === 'object' && value.ratingValue_Rule) {
                const ruleString = value.ratingValue_Rule;
                const match = ruleString.match(/IF \((.*?)\) THEN \[(.*?)\] ELSE \[NULL\]/);
                
                if (match) {
                    const conditionBlock = match[1]; // e.g., "review_count > 5 AND average_rating > 4.5"
                    const source = match[2];
                    
                    // Split the condition block into individual rules
                    const ruleRegex = /(.*?)\s*(\>|\<\=\=|\!\=\contains|\is empty)\s*(.*?)\s*(AND|OR|$)/g;
                    let conditions = [];
                    let ruleMatch;

                    while ((ruleMatch = ruleRegex.exec(conditionBlock)) !== null) {
                        const [fullMatch, field, operator, val, logic] = ruleMatch;

                        if (field && operator) {
                             conditions.push({
                                field: field.trim(),
                                operator: operator.trim(),
                                value: val ? val.trim() : '',
                                logic: logic ? logic.trim().toUpperCase() : 'END'
                            });
                        }
                    }
                    // Fix the logic on the last rule
                    if (conditions.length > 0) conditions[conditions.length - 1].logic = 'END';

                    newMappings.push({
                        id: nextId++,
                        source: source,
                        target: key,
                        type: 'Condition',
                        conditions: conditions
                    });
                }
            }
        }
        
        // Use default mappings if parsing resulted in an empty array but the JSON wasn't empty
        if (newMappings.length === 0 && Object.keys(json).length > 2) {
             console.warn("Parsing resulted in empty mappings. Using default.");
             return defaultMappings;
        }


    } catch (e) {
        console.error("Error parsing raw JSON back to mappings:", e);
        return false; // Return false if parsing fails
    }

    return newMappings.length > 0 ? newMappings : false;
}

// --- MODAL COMPONENTS (Unchanged from v2) ---

const RuleModal = ({ mapping, onSave, onClose }) => {
    const [rules, setRules] = useState(mapping.conditions || []);

    const addRule = () => {
        // Ensure the previous rule is NOT 'END' before adding a new one
        const newRules = [...rules];
        if (newRules.length > 0) {
            newRules[newRules.length - 1].logic = 'AND'; // Force previous to AND
        }

        setRules([...newRules, { 
            field: mockSources[0], 
            operator: mockOperators[0], 
            value: '', 
            logic: 'END' // New rule is always END until another one is added
        }]);
    };
    
    const updateRule = (index, field, value) => {
        const newRules = rules.map((rule, i) => {
            if (i === index) {
                return { ...rule, [field]: value };
            }
            return rule;
        });
        setRules(newRules);
    };

    const deleteRule = (index) => {
        let newRules = rules.filter((_, i) => i !== index);
        if (newRules.length > 0) {
            // Ensure the new last rule is marked as END
            newRules[newRules.length - 1].logic = 'END';
        }
        setRules(newRules);
    };

    const handleSave = () => {
        onSave(mapping.id, rules);
        onClose();
    };

    // Initialize default if rules are empty
    useEffect(() => {
        if (rules.length === 0) {
            setRules([{ field: mockSources[0], operator: mockOperators[0], value: '', logic: 'END' }]);
        }
    }, []);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 transform transition-all duration-300 scale-100">
                <h3 className="text-2xl font-bold text-brand-primary mb-4 flex items-center">
                    <Zap size={24} className="mr-2" />
                    Conditional Logic Editor
                </h3>
                <p className="text-slate-600 mb-6">Define the specific criteria that must be met to trigger the injection of the **`{mapping.target}`** schema property.</p>

                <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                    {rules.map((rule, index) => (
                        <div key={index} className="flex items-center space-x-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
                            {/* IF / AND / OR */}
                            <div className="w-16 font-bold text-slate-800" style={{ minWidth: '4rem' }}>
                                {index === 0 ? 'IF' : rule.logic}
                            </div>
                            
                            {/* Field */}
                            <select
                                value={rule.field}
                                onChange={(e) => updateRule(index, 'field', e.target.value)}
                                className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                            >
                                <option value="">Select Field</option>
                                {mockSources.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            {/* Operator */}
                            <select
                                value={rule.operator}
                                onChange={(e) => updateRule(index, 'operator', e.target.value)}
                                className="w-24 border border-slate-300 rounded-md p-2 text-sm"
                            >
                                {mockOperators.map(op => <option key={op} value={op}>{op}</option>)}
                            </select>

                            {/* Value */}
                            <input
                                type="text"
                                value={rule.value}
                                onChange={(e) => updateRule(index, 'value', e.target.value)}
                                placeholder="Enter value..."
                                className="w-28 border border-slate-300 rounded-md p-2 text-sm"
                            />
                            
                            {/* Delete */}
                            <button onClick={() => deleteRule(index)} className="p-2 text-red-500 hover:text-red-700">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-slate-200">
                    <button
                        onClick={addRule}
                        className="flex items-center text-sm font-medium text-brand-accent hover:text-brand-primary transition"
                    >
                        <Plus size={18} className="mr-1" /> Add New Condition
                    </button>
                    <div className="space-x-3">
                        <button onClick={onClose} className="py-2 px-4 text-slate-600 hover:bg-slate-100 rounded-lg">
                            Cancel
                        </button>
                        <button onClick={handleSave} className="py-2 px-4 bg-brand-primary text-white font-semibold rounded-lg hover:bg-brand-primary/90">
                            Apply Rules
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


// 1. Node Mapper Component (The visual rule builder)
const NodeMapper = ({ mappings, setMappings, saveStatus }) => {
  const [nextId, setNextId] = useState(mappings.length > 0 ? Math.max(...mappings.map(m => m.id)) + 1 : 1);
  const [modalMapping, setModalMapping] = useState(null); // State to hold mapping being edited in modal

  // Update nextId when mappings are loaded or changed externally
  useEffect(() => {
    if (mappings.length > 0) {
        setNextId(Math.max(...mappings.map(m => m.id)) + 1);
    }
  }, [mappings]);


  const addMapping = () => {
    setMappings([...mappings, {
      id: nextId,
      source: '',
      target: '',
      type: 'Text',
      conditions: [] // Initialize with empty conditions
    }]);
    setNextId(nextId + 1);
  };

  const updateMapping = (id, field, value) => {
    setMappings(mappings.map(m => m.id === id ? { ...m, [field]: value } : m));
  };
  
  const updateConditions = (id, newConditions) => {
      setMappings(mappings.map(m => m.id === id ? { ...m, conditions: newConditions, type: 'Condition' } : m));
  };


  const deleteMapping = (id) => {
    setMappings(mappings.filter(m => m.id !== id));
  };

  const MappingRow = ({ mapping }) => (
    <div className="flex items-center space-x-4 bg-white p-4 rounded-lg shadow-sm border border-slate-100 transition duration-150 ease-in-out hover:shadow-md">
      {/* Source Selector (Input) */}
      <div className="flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">Shopify Source</label>
        <select
          value={mapping.source}
          onChange={(e) => updateMapping(mapping.id, 'source', e.target.value)}
          className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-brand-accent focus:border-brand-accent"
        >
          <option value="">Select Metafield/Data Source</option>
          {mockSources.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Logic/Type */}
      <div className="w-24 text-center">
        <label className="block text-xs font-medium text-slate-500 mb-1">Logic</label>
        <div className={`p-2 text-xs font-bold rounded-full flex items-center justify-center 
            ${mapping.conditions.length > 0 ? 'text-brand-hot bg-brand-hot/10' : 'text-brand-primary bg-brand-primary/10'}`}
        >
            {mapping.conditions.length > 0 ? 'CONDITIONAL' : mapping.type.toUpperCase()}
        </div>
      </div>
      
      {/* Connector Icon */}
      <div className="w-8 text-center text-brand-accent">
        <GitBranch size={20} />
      </div>

      {/* Target Selector (Output) */}
      <div className="flex-1">
        <label className="block text-xs font-medium text-slate-500 mb-1">Schema.org Target</label>
        <select
          value={mapping.target}
          onChange={(e) => updateMapping(mapping.id, 'target', e.target.value)}
          className="w-full border border-slate-300 rounded-md p-2 text-sm focus:ring-brand-hot focus:border-brand-hot"
        >
          <option value="">Select Schema Property</option>
          {mockTargets.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>
      
      {/* Conditional Editor Button */}
      {mapping.target && mapping.source && (
        <button 
            onClick={() => setModalMapping(mapping)}
            className="p-2 text-brand-primary hover:text-brand-accent transition duration-150"
            aria-label="Edit conditional rules"
        >
            <Code size={20} />
        </button>
      )}

      {/* Delete Button */}
      <button
        onClick={() => deleteMapping(mapping.id)}
        className="p-2 text-red-500 hover:text-red-700 transition duration-150"
        aria-label="Delete mapping"
      >
        <Trash2 size={20} />
      </button>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-2xl p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-brand-dark flex items-center mb-4 pb-2 border-b">
        <GitBranch size={20} className="mr-2 text-brand-primary" />
        Universal Property Mapper (Node Editor)
      </h2>
      <div className="text-sm text-slate-500 mb-4">
          Define custom rules by mapping Shopify data fields to Schema.org properties.
      </div>
      
      <div className="space-y-4 overflow-y-auto flex-grow pr-2">
        {mappings.map(mapping => (
          <MappingRow key={mapping.id} mapping={mapping} />
        ))}
        {mappings.length === 0 && (
            <div className="text-center p-8 border-2 border-dashed border-slate-200 rounded-lg text-slate-500">
                Click "Add New Mapping" to begin defining custom schema rules.
            </div>
        )}
      </div>

      <button
        onClick={addMapping}
        className="mt-6 w-full py-3 bg-brand-accent text-white rounded-lg font-bold shadow-md hover:bg-brand-accent/90 transition duration-150 flex items-center justify-center"
        disabled={saveStatus === 'Saving...'}
      >
        <Plus size={20} className="mr-2" />
        Add New Mapping
      </button>
      
      {/* Conditional Modal */}
      {modalMapping && (
          <RuleModal 
              mapping={modalMapping} 
              onSave={(id, conditions) => updateConditions(id, conditions)}
              onClose={() => setModalMapping(null)}
          />
      )}
    </div>
  );
};

// 2. Bi-Directional Schema Editor (The code view/validation)
const JsonOutput = ({ jsonLdOutput, setRawJsonLd, onSync, isRawValid, saveStatus }) => {
  
  const validationStatus = isRawValid ? (
    <span className="text-green-500 flex items-center">
      <CheckCircle size={16} className="mr-1" /> Schema Valid (Zero-Error Agent)
    </span>
  ) : (
    <span className="text-red-500 flex items-center">
      <XCircle size={16} className="mr-1" /> SYNTAX ERROR: Validation Failed
    </span>
  );

  return (
    <div className="bg-brand-dark rounded-xl shadow-2xl p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold text-white flex items-center mb-4 pb-2 border-b border-brand-primary">
        <Terminal size={20} className="mr-2 text-brand-hot" />
        Bi-Directional Schema Editor
      </h2>
      <div className="flex justify-between items-center mb-3 text-sm font-medium">
        <span className="text-slate-300">Final JSON-LD Output:</span>
        <div className="flex items-center space-x-3">
            {validationStatus}
            <button
                onClick={onSync}
                disabled={!isRawValid || saveStatus === 'Saving...'}
                className="flex items-center px-3 py-1 bg-brand-accent text-white text-xs font-semibold rounded-full hover:bg-brand-accent/90 transition disabled:bg-slate-500"
            >
                <RefreshCw size={14} className="mr-1" /> Sync Mapper from Code
            </button>
        </div>
      </div>

      <textarea
        className={`flex-grow bg-slate-900 text-brand-accent font-mono text-xs p-4 rounded-lg resize-none focus:outline-none ${!isRawValid ? 'border-2 border-red-500' : 'border-2 border-transparent'}`}
        value={jsonLdOutput}
        onChange={(e) => setRawJsonLd(e.target.value)}
        style={{ minHeight: '300px' }}
        disabled={saveStatus === 'Saving...'}
      />
      <div className="mt-4 text-xs text-slate-400">
          *Use the Sync
