import { describe, expect, it, vi } from 'vitest';
import {
  DeductionValidationError,
  reconstructSemantics,
  type DeductionAiClient,
  type DeductionRequest,
} from './semanticReconstructionEngine';

const request: DeductionRequest = {
  input: '客户在中国，年龄大于等于18岁且状态为已验证，则可以注册。',
  externalMappingRequested: false,
  sources: [],
};

const validResult = {
  version: 1,
  input: request.input,
  features: [
    { id: 'F1', kind: 'entity', statement: '对象是客户', classification: 'fact', certainty: 'confirmed', entity: '客户', evidence: [{ quote: '客户' }] },
    { id: 'F2', kind: 'space', statement: '客户位于中国', classification: 'fact', certainty: 'confirmed', entity: '客户', value: '中国', evidence: [{ quote: '客户在中国' }] },
    { id: 'F3', kind: 'condition', statement: '年龄大于等于18岁', classification: 'fact', certainty: 'confirmed', attribute: '年龄', value: '18岁', condition: '>=', evidence: [{ quote: '年龄大于等于18岁' }] },
    { id: 'F4', kind: 'condition', statement: '状态为已验证', classification: 'fact', certainty: 'confirmed', attribute: '状态', value: '已验证', condition: '=', evidence: [{ quote: '状态为已验证' }] },
    { id: 'F5', kind: 'result', statement: '可以注册', classification: 'judgment', certainty: 'confirmed', action: '注册', evidence: [{ quote: '可以注册' }] },
  ],
  relations: [
    { id: 'R1', fromFeatureIds: ['F3', 'F4'], toFeatureIds: ['F5'], type: 'condition', operator: 'IF_THEN', statement: '年龄和验证状态共同构成注册条件', certainty: 'confirmed', evidence: [{ quote: '年龄大于等于18岁且状态为已验证，则可以注册' }] },
  ],
  contexts: [
    { id: 'C1', label: '客户在中国', featureIds: ['F3', 'F4', 'F5'], evidence: [{ quote: '客户在中国' }] },
  ],
  structure: {
    id: 'N1', type: 'conditional', label: 'IF / THEN', children: [
      { id: 'N2', type: 'operator', label: 'AND', operator: 'AND', children: [
        { id: 'N3', type: 'feature', label: '年龄大于等于18岁', featureId: 'F3', children: [] },
        { id: 'N4', type: 'feature', label: '状态为已验证', featureId: 'F4', children: [] },
      ] },
      { id: 'N5', type: 'feature', label: '可以注册', featureId: 'F5', children: [] },
    ],
  },
  coreMeaning: { text: request.input, supportingFeatureIds: ['F2', 'F3', 'F4', 'F5'], supportingRelationIds: ['R1'] },
  externalMappings: [],
  punchline: { text: '年龄大于等于18岁且状态为已验证，则可以注册。', supportingFeatureIds: ['F3', 'F4', 'F5'], supportingRelationIds: ['R1'] },
};

const clientFrom = (...responses: unknown[]): DeductionAiClient => {
  const generate = vi.fn();
  responses.forEach(response => generate.mockResolvedValueOnce(JSON.stringify(response)));
  return { generate };
};

describe('semanticReconstructionEngine public seam', () => {
  it('runs reconstruction and audit, anchors evidence, and omits external mapping when not requested', async () => {
    const client = clientFrom(validResult, validResult);
    const result = await reconstructSemantics(request, client);

    expect(client.generate).toHaveBeenCalledTimes(2);
    expect(result.features[2].evidence[0]).toEqual({
      quote: '年龄大于等于18岁',
      start: 6,
      end: 15,
    });
    expect(result.structure.children[0].operator).toBe('AND');
    expect(result.externalMappings).toBeUndefined();
    expect(result.relations[0].certainty).toBe('confirmed');
  });

  it('uses one constrained repair when the audited result references a missing feature', async () => {
    const broken = structuredClone(validResult);
    broken.relations[0].toFeatureIds = ['F404'];
    const client = clientFrom(validResult, broken, validResult);

    const result = await reconstructSemantics(request, client);

    expect(client.generate).toHaveBeenCalledTimes(3);
    expect(result.relations[0].toFeatureIds).toEqual(['F5']);
  });

  it('downgrades an external mapping whose quoted basis is absent from the named user source', async () => {
    const mappedRequest: DeductionRequest = {
      ...request,
      externalMappingRequested: true,
      sources: [{ id: 'S1', title: '注册规则', content: '申请人必须完成身份验证。' }],
    };
    const mapped = {
      ...validResult,
      externalMappings: [{
        id: 'M1', targetKind: 'feature', targetId: 'F4', sourceId: 'S1',
        correspondingObject: '身份验证', correspondingContent: '申请人完成验证',
        matchLevel: '直接对应', basis: { quote: '并不存在的原文' }, validationNote: '直接支持',
      }],
    };
    const client = clientFrom(mapped, mapped);

    const result = await reconstructSemantics(mappedRequest, client);

    expect(result.externalMappings?.[0].matchLevel).toBe('无法确认');
    expect(result.externalMappings?.[0].basis).toBeUndefined();
    expect(result.validation.status).toBe('valid_with_uncertainty');
  });

  it('rejects external mapping requests without user-provided sources before calling AI', async () => {
    const client = clientFrom(validResult);
    await expect(reconstructSemantics({ ...request, externalMappingRequested: true }, client))
      .rejects.toThrow('至少提供一份命名依据');
    expect(client.generate).not.toHaveBeenCalled();
  });

  it('fails closed when the audited and repaired results still cannot be traced to the input', async () => {
    const unsupported = structuredClone(validResult);
    unsupported.features[0].evidence = [{ quote: '输入中不存在的事实' }];
    const client = clientFrom(validResult, unsupported, unsupported);

    await expect(reconstructSemantics(request, client)).rejects.toBeInstanceOf(DeductionValidationError);
  });

  it('fails closed rather than saving an AI-authored claim that exceeds its located quote', async () => {
    const unsupportedClaim = structuredClone(validResult);
    unsupportedClaim.features[0].statement = '客户来自火星';
    unsupportedClaim.features[0].evidence = [{ quote: '客户' }];
    unsupportedClaim.features[0].certainty = 'confirmed';
    unsupportedClaim.coreMeaning = {
      text: '所有客户都应被拒绝。',
      supportingFeatureIds: ['F1'],
      supportingRelationIds: [],
    };
    unsupportedClaim.punchline = {
      text: '客户身份本身就是拒绝理由。',
      supportingFeatureIds: ['F1'],
      supportingRelationIds: [],
    };
    const client = clientFrom(unsupportedClaim, unsupportedClaim, unsupportedClaim);

    await expect(reconstructSemantics(request, client)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining('F1')]),
    });
  });

  it('downgrades a located but unrelated source quote instead of trusting a direct-match label', async () => {
    const mappedRequest: DeductionRequest = {
      ...request,
      externalMappingRequested: true,
      sources: [{ id: 'S1', title: '配送规则', content: '包裹应在三日内送达。' }],
    };
    const mapped = structuredClone(validResult);
    mapped.externalMappings = [{
      id: 'M1', targetKind: 'feature', targetId: 'F4', sourceId: 'S1',
      correspondingObject: '身份验证', correspondingContent: '状态为已验证',
      matchLevel: '直接对应', basis: { quote: '包裹应在三日内送达' }, validationNote: '直接支持',
    }];
    const client = clientFrom(mapped, mapped);

    const result = await reconstructSemantics(mappedRequest, client);

    expect(result.externalMappings?.[0].matchLevel).toBe('仅相关');
    expect(result.validation.status).toBe('valid_with_uncertainty');
  });

  it('downgrades a mapping when one of multiple numeric or time boundaries differs', async () => {
    const numericRequest: DeductionRequest = {
      input: '申请条件为2025年且年龄满18岁。', externalMappingRequested: true,
      sources: [{ id: 'S1', title: '旧规则', content: '申请条件为2024年且年龄满18岁。' }],
    };
    const numericResult = {
      version: 1, input: numericRequest.input,
      features: [{ id: 'F1', kind: 'condition', statement: numericRequest.input, classification: 'fact', certainty: 'confirmed', evidence: [{ quote: numericRequest.input }] }],
      relations: [], contexts: [], structure: { id: 'N1', type: 'feature', label: numericRequest.input, featureId: 'F1', children: [] },
      coreMeaning: { text: numericRequest.input, supportingFeatureIds: ['F1'], supportingRelationIds: [] },
      punchline: { text: numericRequest.input, supportingFeatureIds: ['F1'], supportingRelationIds: [] },
      externalMappings: [{ id: 'M1', targetKind: 'feature', targetId: 'F1', sourceId: 'S1', correspondingObject: '申请条件', correspondingContent: '旧规则', matchLevel: '直接对应', basis: { quote: '申请条件为2024年且年龄满18岁' }, validationNote: '直接支持' }],
    };
    const client = clientFrom(numericResult, numericResult);
    const result = await reconstructSemantics(numericRequest, client);
    expect(result.externalMappings?.[0].matchLevel).toBe('仅相关');
  });

  it('downgrades a relation mapping when the named endpoints appear in the opposite direction', async () => {
    const directionalRequest: DeductionRequest = {
      input: 'A 包含 B。', externalMappingRequested: true,
      sources: [{ id: 'S1', title: '反向规则', content: 'B 包含 A。' }],
    };
    const directionalResult = {
      version: 1, input: directionalRequest.input,
      features: [
        { id: 'F1', kind: 'entity', statement: 'A', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'A' }] },
        { id: 'F2', kind: 'entity', statement: 'B', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'B' }] },
      ],
      relations: [{ id: 'R1', fromFeatureIds: ['F1'], toFeatureIds: ['F2'], type: 'containment', statement: 'A 包含 B', certainty: 'confirmed', evidence: [{ quote: 'A 包含 B' }] }],
      contexts: [], structure: { id: 'N1', type: 'relation', label: '包含', relationId: 'R1', children: [] },
      coreMeaning: { text: 'A 包含 B。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
      punchline: { text: 'A 包含 B。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
      externalMappings: [{ id: 'M1', targetKind: 'relation', targetId: 'R1', sourceId: 'S1', correspondingObject: '包含关系', correspondingContent: 'B 包含 A', matchLevel: '直接对应', basis: { quote: 'B 包含 A' }, validationNote: '直接支持' }],
    };
    const client = clientFrom(directionalResult, directionalResult);
    const result = await reconstructSemantics(directionalRequest, client);
    expect(result.externalMappings?.[0].matchLevel).toBe('仅相关');
  });

  it('downgrades a relation mapping when endpoints match but the relation predicate changes', async () => {
    const predicateRequest: DeductionRequest = {
      input: '甲方包含乙方。', externalMappingRequested: true,
      sources: [{ id: 'S1', title: '不同关系', content: '甲方依赖乙方。' }],
    };
    const predicateResult = {
      version: 1, input: predicateRequest.input,
      features: [
        { id: 'F1', kind: 'entity', statement: '甲方', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: '甲方' }] },
        { id: 'F2', kind: 'entity', statement: '乙方', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: '乙方' }] },
      ],
      relations: [{ id: 'R1', fromFeatureIds: ['F1'], toFeatureIds: ['F2'], type: 'containment', statement: '甲方包含乙方', certainty: 'confirmed', evidence: [{ quote: '甲方包含乙方' }] }],
      contexts: [], structure: { id: 'N1', type: 'relation', label: '包含', relationId: 'R1', children: [] },
      coreMeaning: { text: '甲方包含乙方。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
      punchline: { text: '甲方包含乙方。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
      externalMappings: [{ id: 'M1', targetKind: 'relation', targetId: 'R1', sourceId: 'S1', correspondingObject: '实体关系', correspondingContent: '甲方依赖乙方', matchLevel: '直接对应', basis: { quote: '甲方依赖乙方' }, validationNote: '直接支持' }],
    };
    const client = clientFrom(predicateResult, predicateResult);
    const result = await reconstructSemantics(predicateRequest, client);
    expect(result.externalMappings?.[0].matchLevel).toBe('仅相关');
  });

  it('keeps an explicitly stated dependency relation confirmed', async () => {
    const dependency = structuredClone(validResult);
    dependency.relations[0] = { ...dependency.relations[0], type: 'dependency', operator: undefined, statement: '注册依赖年龄和验证状态', evidence: [{ quote: '年龄大于等于18岁且状态为已验证，则可以注册' }] };
    const client = clientFrom(dependency, dependency);
    const result = await reconstructSemantics(request, client);
    expect(result.relations[0].certainty).toBe('confirmed');
  });

  it('fails closed when a shared context is repeated inside multiple feature statements', async () => {
    const duplicated = structuredClone(validResult);
    duplicated.features[2].statement = '客户在中国时年龄大于等于18岁';
    duplicated.features[2].evidence = [{ quote: '客户在中国，年龄大于等于18岁' }];
    duplicated.features[3].statement = '客户在中国时状态为已验证';
    duplicated.features[3].evidence = [{ quote: '客户在中国，年龄大于等于18岁且状态为已验证' }];
    const client = clientFrom(duplicated, duplicated, duplicated);
    await expect(reconstructSemantics(request, client)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining('公共上下文')]),
    });
  });

  it('fails closed when a one-character shared context is repeated in scoped feature statements', async () => {
    const shortContextRequest: DeductionRequest = { input: 'X 下 A 开启，X 下 B 关闭。', externalMappingRequested: false, sources: [] };
    const shortContextResult = {
      version: 1, input: shortContextRequest.input,
      features: [
        { id: 'F1', kind: 'state', statement: 'X 下 A 开启', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'X 下 A 开启' }] },
        { id: 'F2', kind: 'state', statement: 'X 下 B 关闭', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'X 下 B 关闭' }] },
      ], relations: [],
      contexts: [{ id: 'C1', label: 'X', featureIds: ['F1', 'F2'], evidence: [{ quote: 'X' }] }],
      structure: { id: 'N1', type: 'context', label: 'X', children: [] },
      coreMeaning: { text: shortContextRequest.input, supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: [] },
      punchline: { text: shortContextRequest.input, supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: [] }, externalMappings: [],
    };
    const client = clientFrom(shortContextResult, shortContextResult, shortContextResult);
    await expect(reconstructSemantics(shortContextRequest, client)).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.stringContaining('公共上下文')]),
    });
  });

  it('keeps unfamiliar English fields and UNKNOWN without a domain dictionary', async () => {
    const unfamiliarRequest: DeductionRequest = {
      input: 'CryospherePatch albedoFlux = UNKNOWN.',
      externalMappingRequested: false,
      sources: [],
    };
    const unfamiliarResult = {
      version: 1,
      input: unfamiliarRequest.input,
      features: [
        { id: 'F1', kind: 'entity', statement: 'CryospherePatch', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'CryospherePatch' }] },
        { id: 'F2', kind: 'condition', statement: 'albedoFlux = UNKNOWN', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: 'albedoFlux = UNKNOWN' }] },
      ],
      relations: [],
      contexts: [],
      structure: {
        id: 'N1', type: 'operator', label: '=', operator: 'AND', children: [
          { id: 'N2', type: 'feature', label: 'CryospherePatch', featureId: 'F1', children: [] },
          { id: 'N3', type: 'feature', label: 'albedoFlux = UNKNOWN', featureId: 'F2', children: [] },
        ],
      },
      coreMeaning: { text: unfamiliarRequest.input, supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: [] },
      punchline: { text: unfamiliarRequest.input, supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: [] },
      externalMappings: [],
    };
    const client = clientFrom(unfamiliarResult, unfamiliarResult, unfamiliarResult);

    const result = await reconstructSemantics(unfamiliarRequest, client);

    expect(result.features.map(feature => feature.statement)).toEqual(['CryospherePatch', 'albedoFlux = UNKNOWN']);
    expect(result.features.every(feature => feature.certainty === 'confirmed')).toBe(true);
    expect(result.validation.status).toBe('valid');
  });

  it('fails closed on an asserted causal conclusion when the input only states co-occurrence', async () => {
    const neutralRequest: DeductionRequest = {
      input: '菌丝节点甲与孢子囊乙同时出现，未说明因果。',
      externalMappingRequested: false,
      sources: [],
    };
    const causalDraft = {
      version: 1,
      input: neutralRequest.input,
      features: [
        { id: 'F1', kind: 'entity', statement: '菌丝节点甲', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: '菌丝节点甲' }] },
        { id: 'F2', kind: 'entity', statement: '孢子囊乙', classification: 'fact', certainty: 'confirmed', evidence: [{ quote: '孢子囊乙' }] },
      ],
      relations: [{
        id: 'R1', fromFeatureIds: ['F1'], toFeatureIds: ['F2'], type: 'causation',
        statement: '菌丝节点甲导致孢子囊乙', certainty: 'confirmed', evidence: [{ quote: neutralRequest.input }],
      }],
      contexts: [],
      structure: { id: 'N1', type: 'relation', label: '因果', relationId: 'R1', children: [] },
      coreMeaning: { text: '菌丝节点甲导致孢子囊乙。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
      punchline: { text: '存在因果。', supportingFeatureIds: ['F1', 'F2'], supportingRelationIds: ['R1'] },
      externalMappings: [],
    };
    const client = clientFrom(causalDraft, causalDraft, causalDraft);

    await expect(reconstructSemantics(neutralRequest, client)).rejects.toBeInstanceOf(DeductionValidationError);
  });
});
