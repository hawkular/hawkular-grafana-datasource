import {segmentsToModel, modelToSegments} from '../tagsKVPairsController';
import Q from "q";

describe('TagsKVPairs', function() {

  let newSegment = props => {
    // console.log("Adding segment: " + props.type + ", " + props.value);
    return props;
  };
  let segmentFactory = {
    newSegment: newSegment,
    newKey: key => newSegment({type: 'key', value: key}),
    newCondition: cond => newSegment({type: 'condition', value: cond}),
    newOperator: op => newSegment({type: 'operator', value: op}),
    newKeyValue: v => newSegment({type: 'value', value: v})
  };

  it('should convert empty segments to empty model', function(done) {
    let result = segmentsToModel([]);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert segments to model', function(done) {
    let segments = [
      { type: 'key', value: 'hostname' },
      { type: 'operator', value: ':' },
      { type: 'value', value: ' *' },
      { type: 'operator', value: ',' },
      { type: 'key', value: 'pod' },
      { type: 'operator', value: ':' },
      { type: 'value', value: 'unknown' },
      { type: 'operator', value: ',' }
    ];
    let result = segmentsToModel(segments);
    expect(result).to.deep.equal([
      { name: "hostname", value: "*" },
      { name: "pod", value: "unknown" }
    ]);
    done();
  });

  it('should convert empty model to empty segments', function(done) {
    let result = modelToSegments([], segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert undefined model to empty segments', function(done) {
    let result = modelToSegments(undefined, segmentFactory);
    expect(result).to.deep.equal([]);
    done();
  });

  it('should convert model to segments', function(done) {
    let result = modelToSegments([
      { name: "hostname", value: "*" },
      { name: "pod", value: "unknown" }
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
