/**
 * hooks/useOntologyWorkspaceStore.ts
 *
 * Unified global store for DuckDB Studio Ontology Spatial Analysis Workspace.
 * Manages single-truth Analysis Context, graph topology, live DuckDB grounding,
 * SHACL validation, reasoning explanations, version diffs, and the closed-loop state pipeline.
 */

import { create } from 'zustand';
import {
  AbstractionLevel,
  BusinessDomain,
  OntologyNode,
  OntologyEdge,
  WorkspaceViewMode,
  AnalysisContext,
  ValidationIssue,
  ReasoningReport,
  MappingItem,
  DraftChange,
  StatePipeline,
  VersionDiff,
  FoundPath,
} from '../types/ontologyWorkspace';
import { duckDBService } from '../services/duckdbService';
import {
  SchemaCatalogController,
  ShaclValidationController,
  OntologyReasoningController,
  OntologySqlTranspiler,
  VersionLifecycleController,
  type TableCatalogInfo,
} from '../services/ontology/ontologyWorkspaceBackend';
import {
  findOntologyPaths,
  previewPropertyImpact,
  type PathSearchOptions,
} from '../services/ontology/ontologyWorkspaceModel';
import { ontologyWorkspaceRepository } from '../services/ontology/ontologyWorkspaceRepository';

// Default initial nodes aligned with Screenshot 1, 2, 3
export const INITIAL_NODES: OntologyNode[] = [
  // L0 Upper Ontology
  {
    id: 'Thing',
    name: 'Thing',
    label: 'Thing',
    iri: 'owl:Thing',
    description: 'The root entity of all ontological classes',
    abstractionLevel: 'L0',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    gridColumn: 0,
    gridRow: 0,
    subClassIds: ['BusinessEntity'],
  },
  {
    id: 'BusinessEntity',
    name: 'BusinessEntity',
    label: 'BusinessEntity',
    iri: 'ex:BusinessEntity',
    description: 'An abstract commercial entity with identity and temporal lifecycle',
    abstractionLevel: 'L0',
    domain: 'Customer',
    type: 'class',
    status: 'normal',
    parentClassId: 'Thing',
    parentClassName: 'Thing',
    gridColumn: 1,
    gridRow: 0,
    subClassIds: ['Product', 'Supplier', 'Customer', 'Store', 'Category'],
    dataProperties: [
      { name: 'hasIdentifier', type: 'xsd:string', required: true },
      { name: 'createdAt', type: 'xsd:dateTime', required: true },
    ],
  },

  // L1 Domain Concepts
  {
    id: 'Product',
    name: 'Product',
    label: 'Product',
    iri: 'ex:Product',
    description: 'A product that can be sold or purchased',
    abstractionLevel: 'L1',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    instanceCount: 2350000,
    instanceCountLabel: '2.35M',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    subClassIds: ['Electronics', 'Clothing'],
    mappedTable: 'main.products',
    gridColumn: 0,
    gridRow: 1,
    objectProperties: [
      { name: 'belongsToCategory', targetClassId: 'Category', targetClassName: 'Category', cardinality: '1..1', asserted: true },
      { name: 'suppliedBy', targetClassId: 'Supplier', targetClassName: 'Supplier', cardinality: '0..*', asserted: true },
      { name: 'soldAt', targetClassId: 'Store', targetClassName: 'Store', cardinality: '0..*', asserted: true },
    ],
    dataProperties: [
      { name: 'name', type: 'xsd:string', required: true },
      { name: 'price', type: 'xsd:decimal', required: true },
      { name: 'sku', type: 'xsd:string', required: true },
      { name: 'currency', type: 'xsd:string', required: false },
    ],
  },
  {
    id: 'Category',
    name: 'Category',
    label: 'Category',
    iri: 'ex:Category',
    description: 'Hierarchical product classification and taxonomy grouping',
    abstractionLevel: 'L1',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    instanceCount: 1420,
    instanceCountLabel: '1.42K',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    gridColumn: 0,
    gridRow: 1,
    dataProperties: [
      { name: 'categoryName', type: 'xsd:string', required: true },
      { name: 'level', type: 'xsd:integer', required: true },
    ],
  },
  {
    id: 'Supplier',
    name: 'Supplier',
    label: 'Supplier',
    iri: 'ex:Supplier',
    description: 'An external organization that manufactures or supplies goods',
    abstractionLevel: 'L1',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    instanceCount: 1850000,
    instanceCountLabel: '1.85M',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    subClassIds: ['Manufacturer', 'Distributor'],
    gridColumn: 0,
    gridRow: 1,
    objectProperties: [
      { name: 'supplies', targetClassId: 'Product', targetClassName: 'Product', cardinality: '1..*', asserted: true },
      { name: 'hasPreferredSupplier', targetClassId: 'Supplier', targetClassName: 'Supplier', cardinality: '0..1', asserted: true },
    ],
    dataProperties: [
      { name: 'supplierName', type: 'xsd:string', required: true },
      { name: 'deliveryRegion', type: 'xsd:string', required: true },
      { name: 'contactInfo', type: 'xsd:string', required: false },
    ],
  },
  {
    id: 'Customer',
    name: 'Customer',
    label: 'Customer',
    iri: 'ex:Customer',
    description: 'An individual or corporate buyer who places orders',
    abstractionLevel: 'L1',
    domain: 'Customer',
    type: 'class',
    status: 'normal',
    instanceCount: 850000,
    instanceCountLabel: '850K',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    subClassIds: ['VIPCustomer', 'RegularCustomer'],
    mappedTable: 'main.customers',
    gridColumn: 1,
    gridRow: 1,
    objectProperties: [
      { name: 'placesOrder', targetClassId: 'Order', targetClassName: 'Order', cardinality: '0..*', asserted: true },
    ],
    dataProperties: [
      { name: 'customerName', type: 'xsd:string', required: true },
      { name: 'email', type: 'xsd:string', required: true },
      { name: 'tier', type: 'xsd:string', required: false },
    ],
  },
  {
    id: 'Order',
    name: 'Order',
    label: 'Order',
    iri: 'ex:Order',
    description: 'A transaction record containing purchased items and payment details',
    abstractionLevel: 'L1',
    domain: 'Fulfillment',
    type: 'class',
    status: 'normal',
    instanceCount: 4100000,
    instanceCountLabel: '4.1M',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    subClassIds: ['OnlineOrder', 'InStoreOrder'],
    mappedTable: 'main.orders',
    gridColumn: 2,
    gridRow: 1,
    objectProperties: [
      { name: 'hasProduct', targetClassId: 'Product', targetClassName: 'Product', cardinality: '1..*', asserted: true },
      { name: 'generatesShipment', targetClassId: 'Shipment', targetClassName: 'Shipment', cardinality: '1..1', asserted: true },
      { name: 'hasPayment', targetClassId: 'Payment', targetClassName: 'Payment', cardinality: '1..*', asserted: true },
    ],
    dataProperties: [
      { name: 'orderDate', type: 'xsd:dateTime', required: true },
      { name: 'totalAmount', type: 'xsd:decimal', required: true },
      { name: 'orderStatus', type: 'xsd:string', required: true },
    ],
  },
  {
    id: 'Shipment',
    name: 'Shipment',
    label: 'Shipment',
    iri: 'ex:Shipment',
    description: 'Logistics delivery dispatch and tracking record',
    abstractionLevel: 'L1',
    domain: 'Fulfillment',
    type: 'class',
    status: 'normal',
    instanceCount: 3200000,
    instanceCountLabel: '3.2M',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    mappedTable: 'main.shipments',
    gridColumn: 2,
    gridRow: 1,
    objectProperties: [
      { name: 'deliveredTo', targetClassId: 'Customer', targetClassName: 'Customer', cardinality: '1..1', asserted: true },
    ],
    dataProperties: [
      { name: 'trackingNumber', type: 'xsd:string', required: true },
      { name: 'carrier', type: 'xsd:string', required: true },
    ],
  },
  {
    id: 'Store',
    name: 'Store',
    label: 'Store',
    iri: 'ex:Store',
    description: 'Retail offline outlet or online sales storefront',
    abstractionLevel: 'L1',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    instanceCount: 380,
    instanceCountLabel: '380',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    gridColumn: 0,
    gridRow: 1,
    dataProperties: [
      { name: 'storeName', type: 'xsd:string', required: true },
      { name: 'city', type: 'xsd:string', required: true },
    ],
  },
  {
    id: 'RiskEvent',
    name: 'RiskEvent',
    label: 'RiskEvent',
    iri: 'ex:RiskEvent',
    description: 'Security, anomaly, or transaction fraud alert record',
    abstractionLevel: 'L1',
    domain: 'Risk',
    type: 'class',
    status: 'normal',
    instanceCount: 1200000,
    instanceCountLabel: '1.2M',
    mappingState: 'mapped',
    validationState: 'warning',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    subClassIds: ['FraudEvent', 'Chargeback'],
    gridColumn: 3,
    gridRow: 1,
    objectProperties: [
      { name: 'flagsOrder', targetClassId: 'Order', targetClassName: 'Order', cardinality: '1..1', asserted: true },
    ],
    dataProperties: [
      { name: 'riskScore', type: 'xsd:decimal', required: true },
      { name: 'riskType', type: 'xsd:string', required: true },
    ],
  },
  {
    id: 'Payment',
    name: 'Payment',
    label: 'Payment',
    iri: 'ex:Payment',
    description: 'Settlement record and financial transaction receipt',
    abstractionLevel: 'L1',
    domain: 'Finance',
    type: 'class',
    status: 'normal',
    instanceCount: 3900000,
    instanceCountLabel: '3.9M',
    mappingState: 'mapped',
    validationState: 'valid',
    parentClassId: 'BusinessEntity',
    parentClassName: 'BusinessEntity',
    mappedTable: 'ext_payments',
    gridColumn: 4,
    gridRow: 1,
    objectProperties: [
      { name: 'paysOrder', targetClassId: 'Order', targetClassName: 'Order', cardinality: '1..1', asserted: true },
    ],
    dataProperties: [
      { name: 'amount', type: 'xsd:decimal', required: true },
      { name: 'paymentMethod', type: 'xsd:string', required: true },
    ],
  },

  // L2 Specialized Concepts
  {
    id: 'Electronics',
    name: 'Electronics',
    label: 'Electronics',
    iri: 'ex:Electronics',
    description: 'Consumer electronics, computers, and digital devices',
    abstractionLevel: 'L2',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    parentClassId: 'Product',
    parentClassName: 'Product',
    gridColumn: 0,
    gridRow: 2,
    dataProperties: [
      { name: 'warrantyMonths', type: 'xsd:integer', required: false },
      { name: 'voltage', type: 'xsd:string', required: false },
    ],
  },
  {
    id: 'Clothing',
    name: 'Clothing',
    label: 'Clothing',
    iri: 'ex:Clothing',
    description: 'Apparel, textiles, and fashion garments',
    abstractionLevel: 'L2',
    domain: 'Commerce',
    type: 'class',
    status: 'normal',
    parentClassId: 'Product',
    parentClassName: 'Product',
    gridColumn: 0,
    gridRow: 2,
    dataProperties: [
      { name: 'size', type: 'xsd:string', required: false },
      { name: 'material', type: 'xsd:string', required: false },
    ],
  },
  {
    id: 'VIPCustomer',
    name: 'VIPCustomer',
    label: 'VIPCustomer',
    iri: 'ex:VIPCustomer',
    description: 'High-value customer with priority support and discounts',
    abstractionLevel: 'L2',
    domain: 'Customer',
    type: 'class',
    status: 'normal',
    parentClassId: 'Customer',
    parentClassName: 'Customer',
    gridColumn: 1,
    gridRow: 2,
  },
  {
    id: 'OnlineOrder',
    name: 'OnlineOrder',
    label: 'OnlineOrder',
    iri: 'ex:OnlineOrder',
    description: 'Order placed through web or mobile apps',
    abstractionLevel: 'L2',
    domain: 'Fulfillment',
    type: 'class',
    status: 'normal',
    parentClassId: 'Order',
    parentClassName: 'Order',
    gridColumn: 2,
    gridRow: 2,
  },
  {
    id: 'InStoreOrder',
    name: 'InStoreOrder',
    label: 'InStoreOrder',
    iri: 'ex:InStoreOrder',
    description: 'Order placed in a brick-and-mortar store POS terminal',
    abstractionLevel: 'L2',
    domain: 'Fulfillment',
    type: 'class',
    status: 'normal',
    parentClassId: 'Order',
    parentClassName: 'Order',
    gridColumn: 2,
    gridRow: 2,
  },
  {
    id: 'Return',
    name: 'Return',
    label: 'Return',
    iri: 'ex:Return',
    description: 'Return or refund request for delivered items',
    abstractionLevel: 'L2',
    domain: 'Fulfillment',
    type: 'class',
    status: 'normal',
    parentClassId: 'Order',
    parentClassName: 'Order',
    gridColumn: 2,
    gridRow: 2,
  },
  {
    id: 'FraudEvent',
    name: 'FraudEvent',
    label: 'FraudEvent',
    iri: 'ex:FraudEvent',
    description: 'Confirmed suspicious fraudulent activity',
    abstractionLevel: 'L2',
    domain: 'Risk',
    type: 'class',
    status: 'normal',
    parentClassId: 'RiskEvent',
    parentClassName: 'RiskEvent',
    gridColumn: 3,
    gridRow: 2,
  },

  // L3 Individuals (Aggregated)
  {
    id: 'Product_Agg',
    name: 'Product (2.35M)',
    label: 'Product',
    iri: 'ex:Product_Individuals',
    description: 'Aggregated individual instances of Product class',
    abstractionLevel: 'L3',
    domain: 'Commerce',
    type: 'individual_agg',
    status: 'normal',
    instanceCount: 2350000,
    instanceCountLabel: '2.35M',
    parentClassId: 'Product',
    gridColumn: 0,
    gridRow: 3,
  },
  {
    id: 'Customer_Agg',
    name: 'Customer (850K)',
    label: 'Customer',
    iri: 'ex:Customer_Individuals',
    description: 'Aggregated individual instances of Customer class',
    abstractionLevel: 'L3',
    domain: 'Customer',
    type: 'individual_agg',
    status: 'normal',
    instanceCount: 850000,
    instanceCountLabel: '850K',
    parentClassId: 'Customer',
    gridColumn: 1,
    gridRow: 3,
  },
  {
    id: 'Order_Agg',
    name: 'Order (4.1M)',
    label: 'Order',
    iri: 'ex:Order_Individuals',
    description: 'Aggregated individual instances of Order class',
    abstractionLevel: 'L3',
    domain: 'Fulfillment',
    type: 'individual_agg',
    status: 'normal',
    instanceCount: 4100000,
    instanceCountLabel: '4.1M',
    parentClassId: 'Order',
    gridColumn: 2,
    gridRow: 3,
  },
  {
    id: 'Shipment_Agg',
    name: 'Shipment (3.2M)',
    label: 'Shipment',
    iri: 'ex:Shipment_Individuals',
    description: 'Aggregated individual instances of Shipment class',
    abstractionLevel: 'L3',
    domain: 'Fulfillment',
    type: 'individual_agg',
    status: 'normal',
    instanceCount: 3200000,
    instanceCountLabel: '3.2M',
    parentClassId: 'Shipment',
    gridColumn: 2,
    gridRow: 3,
  },
  {
    id: 'RiskEvent_Agg',
    name: 'RiskEvent (1.2M)',
    label: 'RiskEvent',
    iri: 'ex:RiskEvent_Individuals',
    description: 'Aggregated individual instances of RiskEvent class',
    abstractionLevel: 'L3',
    domain: 'Risk',
    type: 'individual_agg',
    status: 'normal',
    instanceCount: 1200000,
    instanceCountLabel: '1.2M',
    parentClassId: 'RiskEvent',
    gridColumn: 3,
    gridRow: 3,
  },
  {
    id: 'Payment_Agg',
    name: 'Payment (3.9M)',
    label: 'Payment',
    iri: 'ex:Payment_Individuals',
    description: 'Aggregated individual instances of Payment class',
    abstractionLevel: 'L3',
    domain: 'Finance',
    type: 'individual_agg',
    status: 'normal',
    instanceCount: 3900000,
    instanceCountLabel: '3.9M',
    parentClassId: 'Payment',
    gridColumn: 4,
    gridRow: 3,
  },

  // GROUNDING LAYER (Physical Data Tables)
  {
    id: 'main.products',
    name: 'main.products',
    label: 'main.products',
    iri: 'duckdb:main.products',
    description: 'Physical DuckDB table storing raw product catalog records',
    abstractionLevel: 'GROUNDING',
    domain: 'Commerce',
    type: 'data_source',
    status: 'normal',
    instanceCount: 2350000,
    instanceCountLabel: '2.35M rows',
    mappingState: 'mapped',
    gridColumn: 0,
    gridRow: 4,
  },
  {
    id: 'main.customers',
    name: 'main.customers',
    label: 'main.customers',
    iri: 'duckdb:main.customers',
    description: 'Physical DuckDB table storing registered customer accounts',
    abstractionLevel: 'GROUNDING',
    domain: 'Customer',
    type: 'data_source',
    status: 'normal',
    instanceCount: 850000,
    instanceCountLabel: '850K rows',
    mappingState: 'mapped',
    gridColumn: 1,
    gridRow: 4,
  },
  {
    id: 'main.orders',
    name: 'main.orders',
    label: 'main.orders',
    iri: 'duckdb:main.orders',
    description: 'Physical DuckDB table storing sales orders',
    abstractionLevel: 'GROUNDING',
    domain: 'Fulfillment',
    type: 'data_source',
    status: 'normal',
    instanceCount: 4100000,
    instanceCountLabel: '4.1M rows',
    mappingState: 'mapped',
    gridColumn: 2,
    gridRow: 4,
  },
  {
    id: 'main.shipments',
    name: 'main.shipments',
    label: 'main.shipments',
    iri: 'duckdb:main.shipments',
    description: 'Physical DuckDB table storing delivery logistics records',
    abstractionLevel: 'GROUNDING',
    domain: 'Fulfillment',
    type: 'data_source',
    status: 'normal',
    instanceCount: 3200000,
    instanceCountLabel: '3.2M rows',
    mappingState: 'mapped',
    gridColumn: 2,
    gridRow: 4,
  },
  {
    id: 'ext_payments',
    name: 'ext_payments',
    label: 'ext_payments',
    iri: 'api:ext_payments',
    description: 'External payment gateway REST API data source',
    abstractionLevel: 'GROUNDING',
    domain: 'Finance',
    type: 'data_source',
    status: 'normal',
    instanceCount: 3900000,
    instanceCountLabel: 'External API',
    mappingState: 'mapped',
    gridColumn: 4,
    gridRow: 4,
  },
];

export const INITIAL_EDGES: OntologyEdge[] = [
  // Hierarchy: subClassOf (L0 -> L1, L1 -> L2)
  { id: 'e1', source: 'BusinessEntity', target: 'Thing', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e2', source: 'Product', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e3', source: 'Category', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e4', source: 'Supplier', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e5', source: 'Customer', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e6', source: 'Order', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e7', source: 'Shipment', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e8', source: 'Store', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e9', source: 'RiskEvent', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e10', source: 'Payment', target: 'BusinessEntity', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e11', source: 'Electronics', target: 'Product', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e12', source: 'Clothing', target: 'Product', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e13', source: 'VIPCustomer', target: 'Customer', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e14', source: 'OnlineOrder', target: 'Order', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e15', source: 'InStoreOrder', target: 'Order', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e16', source: 'Return', target: 'Order', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },
  { id: 'e17', source: 'FraudEvent', target: 'RiskEvent', relationName: 'subClassOf', type: 'subClassOf', asserted: true, inferred: false, mapping: false },

  // Same-level Object Properties
  { id: 'e18', source: 'Product', target: 'Category', relationName: 'belongsToCategory', type: 'object_property', cardinality: '1..1', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e19', source: 'Product', target: 'Supplier', relationName: 'suppliedBy', type: 'object_property', cardinality: '0..*', asserted: true, inferred: false, mapping: false, confidence: 'High', rangeExpression: 'Supplier' },
  { id: 'e20', source: 'Product', target: 'Store', relationName: 'soldAt', type: 'object_property', cardinality: '0..*', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e21', source: 'Customer', target: 'Order', relationName: 'placesOrder', type: 'object_property', cardinality: '0..*', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e22', source: 'Order', target: 'Product', relationName: 'hasProduct', type: 'object_property', cardinality: '1..*', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e23', source: 'Order', target: 'Shipment', relationName: 'generatesShipment', type: 'object_property', cardinality: '1..1', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e24', source: 'Order', target: 'Payment', relationName: 'hasPayment', type: 'object_property', cardinality: '1..*', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e25', source: 'RiskEvent', target: 'Order', relationName: 'flagsOrder', type: 'object_property', cardinality: '1..1', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e26', source: 'Supplier', target: 'Category', relationName: 'suppliesCategory', type: 'object_property', cardinality: '1..*', asserted: true, inferred: false, mapping: false, confidence: 'High' },
  { id: 'e27', source: 'Supplier', target: 'Supplier', relationName: 'hasPreferredSupplier', type: 'object_property', cardinality: '0..1', asserted: true, inferred: false, mapping: false, confidence: 'High' },

  // Inferred relations (Reasoning engine)
  { id: 'e28', source: 'Order', target: 'Supplier', relationName: 'inferredSupplier', type: 'inferred', cardinality: '1..*', asserted: false, inferred: true, mapping: false, confidence: 'High' },
  { id: 'e29', source: 'RiskEvent', target: 'Customer', relationName: 'flagsHighRiskCustomer', type: 'inferred', cardinality: '0..1', asserted: false, inferred: true, mapping: false, confidence: 'Medium' },

  // Grounding mappedTo edges (L1 -> Physical Table)
  { id: 'e30', source: 'Product', target: 'main.products', relationName: 'mappedTo', type: 'mappedTo', asserted: true, inferred: false, mapping: true },
  { id: 'e31', source: 'Customer', target: 'main.customers', relationName: 'mappedTo', type: 'mappedTo', asserted: true, inferred: false, mapping: true },
  { id: 'e32', source: 'Order', target: 'main.orders', relationName: 'mappedTo', type: 'mappedTo', asserted: true, inferred: false, mapping: true },
  { id: 'e33', source: 'Shipment', target: 'main.shipments', relationName: 'mappedTo', type: 'mappedTo', asserted: true, inferred: false, mapping: true },
  { id: 'e34', source: 'Payment', target: 'ext_payments', relationName: 'mappedTo', type: 'mappedTo', asserted: true, inferred: false, mapping: true },
];

export const INITIAL_MAPPINGS: MappingItem[] = [
  {
    id: 'map_products',
    sourceTable: 'main.products',
    targetClass: 'Product',
    status: 'mapped',
    sampleRowsCount: 2350000,
    validRate: 0.998,
    schemaDrift: false,
    fields: [
      { sourceColumn: 'id', targetProperty: 'hasIdentifier', sourceType: 'BIGINT', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'name', targetProperty: 'name', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'price', targetProperty: 'price', sourceType: 'DECIMAL(18,2)', targetType: 'xsd:decimal', status: 'mapped' },
      { sourceColumn: 'sku', targetProperty: 'sku', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'category_id', targetProperty: 'belongsToCategory', sourceType: 'BIGINT', targetType: 'Category', status: 'mapped' },
    ],
  },
  {
    id: 'map_orders',
    sourceTable: 'main.orders',
    targetClass: 'Order',
    status: 'mapped',
    sampleRowsCount: 4100000,
    validRate: 1.0,
    schemaDrift: false,
    fields: [
      { sourceColumn: 'order_id', targetProperty: 'hasIdentifier', sourceType: 'BIGINT', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'order_date', targetProperty: 'orderDate', sourceType: 'TIMESTAMP', targetType: 'xsd:dateTime', status: 'mapped' },
      { sourceColumn: 'amount', targetProperty: 'totalAmount', sourceType: 'DECIMAL(18,2)', targetType: 'xsd:decimal', status: 'mapped' },
      { sourceColumn: 'customer_id', targetProperty: 'placesOrder', sourceType: 'BIGINT', targetType: 'Customer', status: 'mapped' },
    ],
  },
  {
    id: 'map_customers',
    sourceTable: 'main.customers',
    targetClass: 'Customer',
    status: 'mapped',
    sampleRowsCount: 850000,
    validRate: 1.0,
    schemaDrift: false,
    fields: [
      { sourceColumn: 'customer_id', targetProperty: 'hasIdentifier', sourceType: 'BIGINT', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'name', targetProperty: 'customerName', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'email', targetProperty: 'email', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
    ],
  },
  {
    id: 'map_shipments',
    sourceTable: 'main.shipments',
    targetClass: 'Shipment',
    status: 'mapped',
    sampleRowsCount: 3200000,
    validRate: 0.995,
    schemaDrift: false,
    fields: [
      { sourceColumn: 'shipment_id', targetProperty: 'hasIdentifier', sourceType: 'BIGINT', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'tracking_no', targetProperty: 'trackingNumber', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'carrier', targetProperty: 'carrier', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
    ],
  },
  {
    id: 'ext_payments',
    sourceTable: 'ext_payments',
    targetClass: 'Payment',
    status: 'mapped',
    sampleRowsCount: 3900000,
    validRate: 0.999,
    schemaDrift: false,
    fields: [
      { sourceColumn: 'payment_id', targetProperty: 'hasIdentifier', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
      { sourceColumn: 'amount', targetProperty: 'amount', sourceType: 'DECIMAL(18,2)', targetType: 'xsd:decimal', status: 'mapped' },
      { sourceColumn: 'method', targetProperty: 'paymentMethod', sourceType: 'VARCHAR', targetType: 'xsd:string', status: 'mapped' },
    ],
  },
];

export const INITIAL_VALIDATION_ISSUES: ValidationIssue[] = [
  {
    id: 'v-001',
    severity: 'warning',
    focusNode: 'Product',
    focusNodeName: 'Product',
    resultPath: 'Product.price',
    expectedValue: 'DECIMAL',
    actualValue: 'DECIMAL(18,2)',
    sourceTable: 'main.products',
    sourceColumn: 'price',
    constraint: 'sh:datatype',
    message: 'Data property price has high precision in database, matching xsd:decimal constraint with minor scale truncation.',
  },
  {
    id: 'v-002',
    severity: 'warning',
    focusNode: 'RiskEvent',
    focusNodeName: 'RiskEvent',
    resultPath: 'RiskEvent.riskScore',
    expectedValue: 'Range [0.0, 1.0]',
    actualValue: 'Max 1.25 (3 outliers)',
    sourceTable: 'main._sys_audit_log',
    sourceColumn: 'details',
    constraint: 'sh:maxInclusive',
    message: 'Found 3 anomaly records where riskScore exceeds 1.0 threshold in risk detection events.',
  },
];

export const INITIAL_REASONING_REPORT: ReasoningReport = {
  status: 'current',
  duration: '00:04.12',
  newInferredCount: 17,
  removedInferredCount: 3,
  totalInferredAxioms: 214,
  lastRunTime: '10:31:05',
  inferredAxioms: [
    {
      id: 'inf-01',
      subject: 'Order',
      predicate: 'inferredSupplier',
      object: 'Supplier',
      ruleName: 'OrderSupplierTransitivityRule',
      premises: ['Order hasProduct Product', 'Product suppliedBy Supplier'],
      confidence: 0.98,
    },
    {
      id: 'inf-02',
      subject: 'RiskEvent',
      predicate: 'flagsHighRiskCustomer',
      object: 'Customer',
      ruleName: 'HighRiskCustomerPropagationRule',
      premises: ['RiskEvent flagsOrder Order', 'Customer placesOrder Order', 'RiskEvent.riskScore > 0.85'],
      confidence: 0.92,
    },
  ],
};

export const INITIAL_DIFF: VersionDiff = {
  baseVersion: 'v0.8',
  compareVersion: 'v0.9',
  changes: [
    {
      id: 'diff-01',
      type: 'added',
      entityType: 'object_property',
      entityName: 'manufacturedBy',
      level: 'L1',
      domain: 'Commerce',
      description: 'Domain: Product, Range: Manufacturer (New property in v0.9)',
      impact: {
        classesCount: 2,
        objectPropertiesCount: 1,
        dataPropertiesCount: 0,
        axiomsCount: 3,
        mappingsCount: 1,
        validationCount: 0,
        inferredAxiomsCount: 5,
        examples: ['Product', 'Manufacturer'],
      },
      author: 'ontology_admin',
      time: '2026-08-30 18:20',
    },
    {
      id: 'diff-02',
      type: 'added',
      entityType: 'class',
      entityName: 'OnlineOrderSpecial',
      level: 'L2',
      domain: 'Fulfillment',
      description: 'SubClassOf: OnlineOrder (Specialized promotion orders)',
      impact: {
        classesCount: 1,
        objectPropertiesCount: 0,
        dataPropertiesCount: 2,
        axiomsCount: 2,
        mappingsCount: 0,
        validationCount: 0,
        inferredAxiomsCount: 2,
        examples: ['OnlineOrderSpecial'],
      },
      author: 'ontology_admin',
      time: '2026-08-30 18:22',
    },
    {
      id: 'diff-03',
      type: 'modified',
      entityType: 'object_property',
      entityName: 'suppliedBy',
      level: 'L1',
      domain: 'Commerce',
      description: 'Range expanded: Supplier → Supplier OR Store',
      beforeValue: 'Range: Supplier',
      afterValue: 'Range: Supplier OR Store',
      impact: {
        classesCount: 3,
        objectPropertiesCount: 1,
        dataPropertiesCount: 0,
        axiomsCount: 7,
        mappingsCount: 1,
        validationCount: 2,
        inferredAxiomsCount: 12,
        examples: ['OnlineOrder', 'Return', 'preferredSupplier', 'Product'],
      },
      author: 'ontology_admin',
      time: '2026-08-30 19:45',
    },
    {
      id: 'diff-04',
      type: 'removed',
      entityType: 'data_property',
      entityName: 'oldCategory',
      level: 'L1',
      domain: 'Commerce',
      description: 'Domain: Product (Deprecated legacy column)',
      impact: {
        classesCount: 1,
        objectPropertiesCount: 0,
        dataPropertiesCount: 1,
        axiomsCount: 1,
        mappingsCount: 0,
        validationCount: 0,
        inferredAxiomsCount: 0,
      },
      author: 'ontology_admin',
      time: '2026-08-30 19:50',
    },
  ],
};

interface OntologyWorkspaceState {
  nodes: OntologyNode[];
  edges: OntologyEdge[];
  mappings: MappingItem[];
  validationIssues: ValidationIssue[];
  reasoningReport: ReasoningReport;
  versionDiff: VersionDiff;
  draftChanges: DraftChange[];
  statePipeline: StatePipeline;
  context: AnalysisContext;
  workspaceStatus: 'idle' | 'loading' | 'ready' | 'error';
  workspaceError: string | null;
  currentRevisionId: string;
  currentVersion: string;
  revisions: Array<{ revisionId: string; version: string; createdAt?: string; author: string; message: string }>;
  validationRunId: string | null;
  reasoningRunId: string | null;
  publishing: boolean;

  // Modals & UI States
  showChangePreviewModal: boolean;
  activePropertyEditTarget: {
    propertyId: string;
    propertyName: string;
    domain: string;
    range: string;
    characteristics: {
      functional?: boolean;
      transitive?: boolean;
      symmetric?: boolean;
      asymmetric?: boolean;
    };
  } | null;
  selectedDrawerTab: 'relations' | 'usage' | 'validation' | 'reasoning' | 'mappings' | 'changes' | 'dataPreview' | 'pathExplorer';
  isDrawerOpen: boolean;
  drawerHeight: number;
  dataPreviewTable: string | null;
  dataPreviewRows: any[];
  dataPreviewLoading: boolean;
  dataPreviewError: string | null;
  catalogTables: TableCatalogInfo[];

  // Actions
  setActiveMode: (mode: WorkspaceViewMode) => void;
  setFocusEntity: (id: string | null) => void;
  selectEntity: (id: string, isMulti?: boolean) => void;
  selectRelation: (id: string | null) => void;
  setDomainFilter: (domain: string) => void;
  setRelationTypeFilter: (type: string) => void;
  setAssertedInferredFilter: (filter: 'all' | 'asserted' | 'inferred') => void;
  setDataSourceFilter: (filter: string) => void;
  setShowInstancesMode: (mode: AnalysisContext['showInstancesMode']) => void;
  setDepth: (depth: number) => void;
  setMatrixLayer: (layer: 'L0' | 'L1' | 'L2') => void;
  setPathEndpoints: (source: string | null, target: string | null) => void;
  findPaths: (source: string, target: string, options?: PathSearchOptions) => FoundPath[];
  setSelectedDrawerTab: (tab: OntologyWorkspaceState['selectedDrawerTab']) => void;
  toggleDrawer: () => void;
  setDrawerHeight: (height: number) => void;
  loadTableDataPreview: (tableName: string) => Promise<void>;
  initializeWorkspace: () => Promise<void>;

  // Editing & Pipeline Actions
  openPropertyEditModal: (propertyName: string) => void;
  closePropertyEditModal: () => void;
  applyPropertyEditToDraft: (data: {
    propertyName: string;
    domain: string;
    range: string;
    characteristics: any;
  }) => void;
  runValidation: () => Promise<void>;
  runReasoning: () => Promise<void>;
  publishDraft: () => Promise<void>;

  // Navigation History
  navigateBack: () => void;
  navigateForward: () => void;
  navigateEsc: () => void;
}

const contextHistoryEntry = (context: AnalysisContext, patch: Partial<AnalysisContext> = {}) => {
  const next = { ...context, ...patch };
  return {
    mode: next.activeMode,
    focusEntityId: next.focusEntityId,
    selectedEntityIds: next.selectedEntityIds,
    selectedRelationId: next.selectedRelationId,
    sourceEntityId: next.sourceEntityId,
    targetEntityId: next.targetEntityId,
    domainFilter: next.domainFilter,
    relationTypeFilter: next.relationTypeFilter,
    assertedInferredFilter: next.assertedInferredFilter,
    dataSourceFilter: next.dataSourceFilter,
    showInstancesMode: next.showInstancesMode,
    depth: next.depth,
    matrixLayer: next.matrixLayer,
  };
};

const pushContextHistory = (context: AnalysisContext, patch: Partial<AnalysisContext>): AnalysisContext => {
  const merged = { ...context, ...patch };
  const history = [
    ...context.history.slice(0, context.historyIndex + 1),
    contextHistoryEntry(merged),
  ];
  return { ...merged, history, historyIndex: history.length - 1 };
};

const nextVersion = (version: string): string => {
  const match = version.match(/^v?(\d+)\.(\d+)$/i);
  if (!match) return `v${Date.now()}`;
  return `v${Number(match[1]) + 1}.0`;
};

export const useOntologyWorkspaceStore = create<OntologyWorkspaceState>((set, get) => ({
  nodes: INITIAL_NODES,
  edges: INITIAL_EDGES,
  mappings: INITIAL_MAPPINGS,
  validationIssues: INITIAL_VALIDATION_ISSUES,
  reasoningReport: INITIAL_REASONING_REPORT,
  versionDiff: INITIAL_DIFF,
  draftChanges: INITIAL_DIFF.changes,
  statePipeline: {
    modelStatus: 'modified',
    mappingStatus: 'up_to_date',
    validationStatus: 'warnings',
    validationWarningCount: 2,
    validationErrorCount: 0,
    reasoningStatus: 'completed',
    draftCount: 5,
  },
  context: {
    activeMode: 'map',
    focusEntityId: 'Product',
    selectedEntityIds: ['Product'],
    selectedRelationId: null,
    sourceEntityId: 'Product',
    targetEntityId: 'main.products',
    domainFilter: 'All',
    relationTypeFilter: 'All',
    assertedInferredFilter: 'all',
    dataSourceFilter: 'All',
    showInstancesMode: 'aggregated',
    depth: 2,
    matrixLayer: 'L1',
    history: [
      {
        mode: 'map',
        focusEntityId: 'Product',
        selectedEntityIds: ['Product'],
        selectedRelationId: null,
      },
    ],
    historyIndex: 0,
  },
  workspaceStatus: 'idle',
  workspaceError: null,
  currentRevisionId: 'rev-v0.9-seed',
  currentVersion: 'v0.9',
  revisions: [],
  validationRunId: null,
  reasoningRunId: null,
  publishing: false,

  showChangePreviewModal: false,
  activePropertyEditTarget: {
    propertyId: 'suppliedBy',
    propertyName: 'suppliedBy',
    domain: 'Product',
    range: 'Supplier OR Store',
    characteristics: {
      functional: false,
      transitive: false,
      symmetric: false,
      asymmetric: false,
    },
  },
  selectedDrawerTab: 'relations',
  isDrawerOpen: true,
  drawerHeight: 220,
  dataPreviewTable: 'main.products',
  dataPreviewRows: [],
  dataPreviewLoading: false,
  dataPreviewError: null,
  catalogTables: [],

  initializeWorkspace: async () => {
    if (get().workspaceStatus === 'loading' || get().workspaceStatus === 'ready') return;
    set({ workspaceStatus: 'loading', workspaceError: null });
    try {
      const seed = {
        revisionId: 'rev-v0.9-seed',
        version: 'v0.9',
        author: 'system',
        message: 'Initial ontology spatial workspace',
        nodes: INITIAL_NODES,
        edges: INITIAL_EDGES,
        mappings: INITIAL_MAPPINGS,
      };
      const snapshot = await ontologyWorkspaceRepository.loadLatestOrSeed(seed);
      let draft = await ontologyWorkspaceRepository.loadDraft('active');
      if (!draft && INITIAL_DIFF.changes.length > 0 && snapshot.revisionId === seed.revisionId) {
        draft = {
          draftId: 'active',
          baseRevisionId: snapshot.revisionId,
          author: 'current_user',
          changes: INITIAL_DIFF.changes,
          statePipeline: get().statePipeline,
        };
        await ontologyWorkspaceRepository.saveDraft(draft);
      }
      const [revisions, catalogTables, reasoningReport] = await Promise.all([
        ontologyWorkspaceRepository.listRevisions(),
        SchemaCatalogController.listPhysicalTables(),
        OntologyReasoningController.executeReasoning(snapshot.nodes, snapshot.edges),
      ]);
      set({
        nodes: snapshot.nodes,
        edges: snapshot.edges,
        mappings: snapshot.mappings,
        currentRevisionId: snapshot.revisionId,
        currentVersion: snapshot.version,
        revisions,
        catalogTables,
        reasoningReport,
        draftChanges: draft?.changes || [],
        statePipeline: draft?.statePipeline || {
          modelStatus: 'clean', mappingStatus: 'up_to_date', validationStatus: 'not_run',
          validationWarningCount: 0, validationErrorCount: 0, reasoningStatus: 'not_run', draftCount: 0,
        },
        workspaceStatus: 'ready',
        workspaceError: null,
      });
    } catch (error) {
      set({
        workspaceStatus: 'error',
        workspaceError: error instanceof Error ? error.message : 'Unable to load ontology workspace',
      });
    }
  },

  setActiveMode: (mode) => {
    const { context } = get();
    if (context.activeMode === mode) return;

    set({
      context: pushContextHistory(context, { activeMode: mode }),
      selectedDrawerTab:
        mode === 'path'
          ? 'pathExplorer'
          : mode === 'matrix'
          ? 'relations'
          : mode === 'local'
          ? 'relations'
          : get().selectedDrawerTab,
    });
  },

  setFocusEntity: (id) => {
    const { context } = get();
    if (!id) return;

    set({
      context: pushContextHistory(context, {
        focusEntityId: id,
        selectedEntityIds: [id],
        selectedRelationId: null,
      }),
    });
  },

  selectEntity: (id, isMulti = false) => {
    const { context } = get();
    let newSelected: string[];

    if (isMulti) {
      if (context.selectedEntityIds.includes(id)) {
        newSelected = context.selectedEntityIds.filter((e) => e !== id);
      } else {
        newSelected = [...context.selectedEntityIds, id];
      }
      // If 2 entities selected with multi-select (Shift+Click), switch to compare view!
      if (newSelected.length === 2) {
        set({
          context: pushContextHistory(context, {
            activeMode: 'compare',
            selectedEntityIds: newSelected,
            focusEntityId: newSelected[0],
            sourceEntityId: newSelected[0],
            targetEntityId: newSelected[1],
          }),
        });
        return;
      }
    } else {
      newSelected = [id];
    }

    set({
      context: pushContextHistory(context, {
        focusEntityId: id,
        selectedEntityIds: newSelected,
        selectedRelationId: null,
      }),
    });
  },

  selectRelation: (id) => {
    const { context, edges } = get();
    if (id === null) {
      set({ context: pushContextHistory(context, { selectedRelationId: null }) });
      return;
    }
    const edge = edges.find((e) => e.id === id);
    if (!edge) return;

    set({
      context: pushContextHistory(context, {
        selectedRelationId: id,
        sourceEntityId: edge.source,
        targetEntityId: edge.target,
        selectedEntityIds: [edge.source, edge.target],
        focusEntityId: edge.source,
      }),
    });
  },

  setDomainFilter: (domain) => {
    set((state) => ({
      context: pushContextHistory(state.context, { domainFilter: domain }),
    }));
  },

  setRelationTypeFilter: (type) => {
    set((state) => ({
      context: pushContextHistory(state.context, { relationTypeFilter: type }),
    }));
  },

  setAssertedInferredFilter: (filter) => {
    set((state) => ({
      context: pushContextHistory(state.context, { assertedInferredFilter: filter }),
    }));
  },

  setDataSourceFilter: (filter) => {
    set((state) => ({ context: pushContextHistory(state.context, { dataSourceFilter: filter }) }));
  },

  setShowInstancesMode: (mode) => {
    set((state) => ({ context: pushContextHistory(state.context, { showInstancesMode: mode }) }));
  },

  setDepth: (depth) => {
    set((state) => ({
      context: pushContextHistory(state.context, { depth }),
    }));
  },

  setMatrixLayer: (layer) => {
    set((state) => ({
      context: pushContextHistory(state.context, { matrixLayer: layer }),
    }));
  },

  setPathEndpoints: (source, target) => {
    set((state) => ({
      context: pushContextHistory(state.context, {
        sourceEntityId: source,
        targetEntityId: target,
        selectedEntityIds: [source, target].filter((value): value is string => Boolean(value)),
      }),
    }));
  },

  findPaths: (source, target, options) =>
    findOntologyPaths(get().nodes, get().edges, source, target, options),

  setSelectedDrawerTab: (tab) => {
    set({ selectedDrawerTab: tab, isDrawerOpen: true });
  },

  toggleDrawer: () => {
    set((state) => ({ isDrawerOpen: !state.isDrawerOpen }));
  },

  setDrawerHeight: (height) => {
    set({ drawerHeight: Math.max(120, Math.min(600, height)) });
  },

  loadTableDataPreview: async (tableName) => {
    set({ dataPreviewLoading: true, dataPreviewTable: tableName, dataPreviewError: null });
    try {
      const sample = await SchemaCatalogController.sampleTableRows(tableName, 50);
      set({ dataPreviewRows: sample, dataPreviewLoading: false });
    } catch (error) {
      set({
        dataPreviewRows: [],
        dataPreviewLoading: false,
        dataPreviewError: error instanceof Error ? error.message : `Unable to query ${tableName}`,
      });
    }
  },

  openPropertyEditModal: (propertyName) => {
    const edge = get().edges.find((item) => item.relationName === propertyName);
    set({
      showChangePreviewModal: true,
      activePropertyEditTarget: {
        propertyId: propertyName,
        propertyName,
        domain: edge?.source || '',
        range: edge?.rangeExpression || edge?.target || '',
        characteristics: edge?.characteristics || {},
      },
    });
  },

  closePropertyEditModal: () => {
    set({ showChangePreviewModal: false });
  },

  applyPropertyEditToDraft: (data) => {
    const { draftChanges, statePipeline, edges, nodes, currentRevisionId } = get();
    const matchingEdges = edges.filter((edge) => edge.relationName === data.propertyName);

    // Compute dynamic impact via VersionLifecycleController
    const impact = previewPropertyImpact(nodes, edges, data.propertyName, data.range);

    const newChange: DraftChange = {
      id: `draft_${Date.now()}`,
      type: 'modified',
      entityType: 'object_property',
      entityName: data.propertyName,
      level: 'L1',
      domain: 'Commerce',
      description: `Range updated: ${data.range}`,
      beforeValue: `Range: ${matchingEdges[0]?.rangeExpression || matchingEdges[0]?.target || 'Unspecified'}`,
      afterValue: `Range: ${data.range}`,
      impact,
      author: 'current_user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Update edge range expression
    const updatedEdges = edges.map((e) =>
      e.relationName === data.propertyName
        ? { ...e, rangeExpression: data.range, characteristics: data.characteristics, stale: true }
        : e
    );

    // Hard Rule §67: Apply to draft immediately cascades state pipeline:
    // Model = Modified, Mapping = Needs Check, Validation = Stale/Not Run, Reasoning = Outdated
    const nextDraft = [newChange, ...draftChanges];
    const nextPipeline: StatePipeline = {
      ...statePipeline,
      modelStatus: 'modified',
      mappingStatus: 'needs_check',
      validationStatus: 'stale',
      reasoningStatus: 'outdated',
      draftCount: nextDraft.length,
    };
    set({
      edges: updatedEdges,
      draftChanges: nextDraft,
      showChangePreviewModal: false,
      statePipeline: nextPipeline,
    });
    void ontologyWorkspaceRepository.saveDraft({
      draftId: 'active', baseRevisionId: currentRevisionId, author: 'current_user',
      changes: nextDraft, statePipeline: nextPipeline,
    }).catch((error) => set({ workspaceError: error instanceof Error ? error.message : 'Draft persistence failed.' }));
  },

  runValidation: async () => {
    set((state) => ({ statePipeline: { ...state.statePipeline, validationStatus: 'running' }, selectedDrawerTab: 'validation' }));
    try {
      const { nodes, mappings, currentRevisionId } = get();
      const issues = await ShaclValidationController.executeShaclValidation(nodes, mappings);
      const errors = issues.filter((issue) => issue.severity === 'error').length;
      const warnings = issues.filter((issue) => issue.severity === 'warning').length;
      const status = errors > 0 ? 'errors' : warnings > 0 ? 'warnings' : 'valid';
      const runId = await ontologyWorkspaceRepository.recordRun('validation', currentRevisionId, status, issues);
      set((state) => ({
        validationIssues: issues, validationRunId: runId,
        statePipeline: { ...state.statePipeline, validationStatus: status, validationWarningCount: warnings, validationErrorCount: errors },
      }));
    } catch (error) {
      set((state) => ({ workspaceError: error instanceof Error ? error.message : 'Validation failed.', statePipeline: { ...state.statePipeline, validationStatus: 'failed' } }));
    }
  },

  runReasoning: async () => {
    set((state) => ({
      statePipeline: {
        ...state.statePipeline,
        reasoningStatus: 'running',
      },
    }));

    try {
      const { nodes, edges, currentRevisionId } = get();
      const report = await OntologyReasoningController.executeReasoning(nodes, edges);
      const inferredEdges: OntologyEdge[] = report.inferredAxioms.map((axiom) => ({
        id: axiom.id, source: axiom.subject, target: axiom.object, relationName: axiom.predicate,
        type: 'inferred', asserted: false, inferred: true, mapping: false,
        confidence: axiom.confidence, sourceRevision: currentRevisionId,
      }));
      const inferredKeys = new Set(inferredEdges.map((edge) => `${edge.source}|${edge.relationName}|${edge.target}`));
      const mergedEdges = [...edges.filter((edge) => !inferredKeys.has(`${edge.source}|${edge.relationName}|${edge.target}`)), ...inferredEdges];
      const runId = await ontologyWorkspaceRepository.recordRun('reasoning', currentRevisionId, 'completed', report);
      set((state) => ({ statePipeline: { ...state.statePipeline, reasoningStatus: 'completed' }, reasoningReport: report, reasoningRunId: runId, edges: mergedEdges, selectedDrawerTab: 'reasoning' }));
    } catch (error) {
      set((state) => ({ workspaceError: error instanceof Error ? error.message : 'Reasoning failed.', statePipeline: { ...state.statePipeline, reasoningStatus: 'outdated' } }));
    }
  },

  publishDraft: async () => {
    const state = get();
    if (state.draftChanges.length === 0) return;
    if (state.statePipeline.validationStatus !== 'valid' && state.statePipeline.validationStatus !== 'warnings') {
      set({ workspaceError: 'Run validation before publishing this draft.' }); return;
    }
    if (state.statePipeline.validationErrorCount > 0 || state.statePipeline.reasoningStatus !== 'completed') {
      set({ workspaceError: 'Publishing requires zero validation errors and current reasoning.' }); return;
    }
    set({ publishing: true, workspaceError: null });
    try {
      const version = nextVersion(state.currentVersion);
      const revisionId = `rev-${version.replace(/^v/, '')}-${Date.now()}`;
      await ontologyWorkspaceRepository.publish({ revisionId, version, author: 'current_user', message: `${state.draftChanges.length} ontology changes`, nodes: state.nodes, edges: state.edges, mappings: state.mappings });
      const revisions = await ontologyWorkspaceRepository.listRevisions();
      const cleanPipeline: StatePipeline = { modelStatus: 'clean', mappingStatus: 'up_to_date', validationStatus: 'valid', validationWarningCount: 0, validationErrorCount: 0, reasoningStatus: 'completed', draftCount: 0 };
      set({ currentRevisionId: revisionId, currentVersion: version, revisions, draftChanges: [], statePipeline: cleanPipeline, publishing: false, versionDiff: { baseVersion: state.currentVersion, compareVersion: version, changes: state.draftChanges } });
    } catch (error) {
      set({ publishing: false, workspaceError: error instanceof Error ? error.message : 'Publishing failed.' });
    }
  },

  navigateBack: () => {
    const { context } = get();
    if (context.historyIndex > 0) {
      const prev = context.history[context.historyIndex - 1];
      set({
        context: {
          ...context,
          activeMode: prev.mode,
          focusEntityId: prev.focusEntityId,
          selectedEntityIds: prev.selectedEntityIds,
          selectedRelationId: prev.selectedRelationId,
          sourceEntityId: prev.sourceEntityId ?? context.sourceEntityId,
          targetEntityId: prev.targetEntityId ?? context.targetEntityId,
          domainFilter: prev.domainFilter ?? context.domainFilter,
          relationTypeFilter: prev.relationTypeFilter ?? context.relationTypeFilter,
          assertedInferredFilter: prev.assertedInferredFilter ?? context.assertedInferredFilter,
          dataSourceFilter: prev.dataSourceFilter ?? context.dataSourceFilter,
          showInstancesMode: prev.showInstancesMode ?? context.showInstancesMode,
          depth: prev.depth ?? context.depth,
          matrixLayer: prev.matrixLayer ?? context.matrixLayer,
          historyIndex: context.historyIndex - 1,
        },
      });
    }
  },

  navigateForward: () => {
    const { context } = get();
    if (context.historyIndex < context.history.length - 1) {
      const next = context.history[context.historyIndex + 1];
      set({
        context: {
          ...context,
          activeMode: next.mode,
          focusEntityId: next.focusEntityId,
          selectedEntityIds: next.selectedEntityIds,
          selectedRelationId: next.selectedRelationId,
          sourceEntityId: next.sourceEntityId ?? context.sourceEntityId,
          targetEntityId: next.targetEntityId ?? context.targetEntityId,
          domainFilter: next.domainFilter ?? context.domainFilter,
          relationTypeFilter: next.relationTypeFilter ?? context.relationTypeFilter,
          assertedInferredFilter: next.assertedInferredFilter ?? context.assertedInferredFilter,
          dataSourceFilter: next.dataSourceFilter ?? context.dataSourceFilter,
          showInstancesMode: next.showInstancesMode ?? context.showInstancesMode,
          depth: next.depth ?? context.depth,
          matrixLayer: next.matrixLayer ?? context.matrixLayer,
          historyIndex: context.historyIndex + 1,
        },
      });
    }
  },

  navigateEsc: () => {
    const { context, showChangePreviewModal } = get();
    if (showChangePreviewModal) { set({ showChangePreviewModal: false }); return; }
    if (context.historyIndex > 0) { get().navigateBack(); return; }
    if (context.selectedEntityIds.length > 1) {
      set({
        context: {
          ...context,
          selectedEntityIds: [context.focusEntityId || 'Product'],
        },
      });
    } else if (context.activeMode !== 'map') {
      get().setActiveMode('map');
    }
  },
}));
