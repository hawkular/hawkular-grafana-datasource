import {segmentsToModel, modelToSegments} from '../tagsKVPairsController';
import Q from 'q';

describe('TagsKVPairs', () => {

  const segmentFactory = {
    newSegment: arg => arg,
    newKey: key => ({type: 'key', value: key}),
    newCondition: cond => ({type: 'condition', value: cond}),
    newOperator: op => ({type: 'operator', value: op}),
    newKeyValue: v => ({type: 'value', value: v})
  };

  it('should convert empty segments to empty model', done => {
    const result = segmentsToModel([]);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert segments to model', done => {
    const segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: ':' },
      { type: 'value', value: ' *' },
      { type: 'operator', value: ',' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: ':' },
      { type: 'value', value: 'unknown' },
      { type: 'operator', value: ',' }
    ];
    const result = segmentsToModel(segments);
    expect(result).to.deep.equal([
      { name: 'hostname', value: '*' },
      { name: 'pod', value: 'unknown' }
    ]);
    done();
  });

  it('should convert empty model to empty segments', done => {
    const result = modelToSegments([], segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert undefined model to empty segments', done => {
    const result = modelToSegments(undefined, segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert model to segments', done => {
    const result = modelToSegments([
      { name: 'hostname', value: '*' },
      { name: 'pod', value: 'unknown' }
    ], segmentFactory);
    expect(result).to.deep.equal([
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: ':' },
      { type: 'value', value: ' *' },
      { type: 'operator', value: ',' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: ':' },
      { type: 'value', value: 'unknown' },
      { type: 'operator', value: ',' }
    ]);
    done();
  });
});
