/**
 * @typedef {Object} ConnectorPort
 * @property {string} name
 * @property {string} type - 'row' | 'lookup' | 'reject' | 'output'
 * @property {string} label
 */

/**
 * @typedef {Object} Connectors
 * @property {ConnectorPort[]} inputs
 * @property {ConnectorPort[]} outputs
 * @property {{ outgoing: string[], incoming: string[] }} triggers
 */

/**
 * @typedef {Object} PropertyGroup
 * @property {string} id
 * @property {string} label
 */

/**
 * @typedef {Object} VisibleWhen
 * @property {string} key
 * @property {*} eq
 */

/**
 * @typedef {Object} ComponentProperty
 * @property {string} key
 * @property {string} label
 * @property {'text'|'number'|'checkbox'|'select'|'file'|'table'|'code'} type
 * @property {*} default
 * @property {string} group
 * @property {boolean} [required]
 * @property {string} [placeholder]
 * @property {string} [tooltip]
 * @property {VisibleWhen} [visibleWhen]
 * @property {{ value: string, label: string }[]} [options]
 * @property {boolean} [allowCustom]
 * @property {string[]} [fileTypes]
 * @property {number} [min]
 * @property {number} [max]
 * @property {{ key: string, label: string, type: string, default?: * }[]} [columns]
 * @property {string} [language]
 */

/**
 * @typedef {Object} RegistryComponent
 * @property {string} label
 * @property {string} icon
 * @property {string} category
 * @property {Connectors} connectors
 * @property {PropertyGroup[]} groups
 * @property {ComponentProperty[]} properties
 */

/**
 * @typedef {Object.<string, RegistryComponent>} ComponentRegistry
 */

// Edge / connection types
export const EDGE_TYPE_ROW = 'row';
export const EDGE_TYPE_TRIGGER = 'trigger';
export const EDGE_TYPE_LOOKUP = 'lookup';
export const EDGE_TYPE_REJECT = 'reject';
