/**
 * Canonical rule AST schema shared by situation exploration and world transitions.
 * Context-specific aliases below restrict which leaf nodes are executable in each
 * runtime, while AND / OR / NOT and the serialized tree shape remain identical.
 */
export interface AstLogicNode<TChild> {
  kind: 'and' | 'or';
  nodeId?: string;
  children: TChild[];
}

export interface AstNotNode<TChild> {
  kind: 'not';
  nodeId?: string;
  child: TChild;
}

export interface FeatureConditionAstNode<TOperator extends string = string> {
  kind: 'condition';
  nodeId: string;
  featureId: string;
  operator: TOperator;
  value?: unknown;
  secondValue?: unknown;
}

export interface RuleReferenceAstNode {
  kind: 'ruleRef';
  nodeId: string;
  ruleId: string;
}

export type OntologyPropertyOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'is_missing'
  | 'is_present';

export interface BoundPropertyAstNode {
  kind: 'property';
  nodeId?: string;
  variable: string;
  propertyId: string;
  operator: OntologyPropertyOperator;
  value?: unknown;
}

export interface BoundRelationAstNode {
  kind: 'relation';
  nodeId?: string;
  sourceVariable: string;
  linkTypeId: number;
  targetVariable: string;
  operator: 'exists' | 'not_exists';
}

export interface BoundDerivedAstNode {
  kind: 'derived';
  nodeId?: string;
  predicate: string;
  variables: string[];
  operator: 'exists' | 'not_exists';
}

export type FeatureRuleAst<TOperator extends string = string> =
  | (AstLogicNode<FeatureRuleAst<TOperator>> & { nodeId: string })
  | (AstNotNode<FeatureRuleAst<TOperator>> & { nodeId: string })
  | FeatureConditionAstNode<TOperator>
  | RuleReferenceAstNode;

export type BoundOntologyRuleAst =
  | AstLogicNode<BoundOntologyRuleAst>
  | AstNotNode<BoundOntologyRuleAst>
  | BoundPropertyAstNode
  | BoundRelationAstNode
  | BoundDerivedAstNode;

export type CanonicalRuleAst = FeatureRuleAst | BoundOntologyRuleAst;
