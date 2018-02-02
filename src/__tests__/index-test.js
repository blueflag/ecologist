
import test from 'ava';
import proxyquire from 'proxyquire'
import Rx from 'rxjs/Rx';

var mockParameters = {
  Parameters: [
    {
      Name: '/test-repo/test/var1',
      Value: 'foo'
    },{
      Name: '/test-repo/test/var2',
      Value: 'bar'
    },{
      Name: '/test-repo/test/var3',
      Value: 'baz'
    },{
      Name: '/test-repo2/test/var1',
      Value: 'pez'
    }
  ]
}
var requestedParams = [
  {
    name: 'var1',
    repo: 'test-repo',
    env: 'VAR_1'
  },{
    name: 'var2',
    repo: 'test-repo',
    env: 'VAR_2'
  },{
    name: 'var3',
    repo: 'test-repo',
    env: 'VAR_3'
  },{
    name: 'var1',
    repo: 'test-repo2',
    env: 'VAR_4'
  },
]



test('resolveParameterNames creates SSM parameter names form repositories, stages and names.', async t =>  {
  var {resolveParameterNames} = proxyquire('../index', {
    'aws-sdk': { '@noCallThru': true, SSM: function(){} }
  });

    var result = Rx
      .Observable
      .from(requestedParams)
      .let(resolveParameterNames('test'))
      .toArray()
      .toPromise()

    t.deepEqual(await result, 
      [
        {name: '/test-repo/test/var1', env: 'VAR_1'},
        {name: '/test-repo/test/var2', env: 'VAR_2'},
        {name: '/test-repo/test/var3', env: 'VAR_3'},
        {name: '/test-repo2/test/var1', env: 'VAR_4'}
      ]
    )
})

test('requestSSMParameters, requests parameters from SSM', async t => {
  var {requestSSMParameters} = proxyquire('../index', {
    'aws-sdk': {
      '@noCallThru': true, 
      SSM: function(){
        return { getParameters : (params, cb) => {
            return {
              promise: () => {
                return Promise.resolve(mockParameters)
              }
            }
          }
        }
      }
    }
  });
  var expectedResult = [
    {
      name: '/test-repo/test/var1',
      value: 'foo'
    },{
      name: '/test-repo/test/var2',
      value: 'bar'
    },{
      name: '/test-repo/test/var3',
      value: 'baz'
    },{
      name: '/test-repo2/test/var1',
      value: 'pez'
    }
  ]
  var result = Rx
    .Observable
    .from(      [
      {name: '/test-repo/test/var1', env: 'VAR_1'},
      {name: '/test-repo/test/var2', env: 'VAR_2'},
      {name: '/test-repo/test/var3', env: 'VAR_3'},
      {name: '/test-repo2/test/var1', env: 'VAR_4'}
    ])
    .let(requestSSMParameters)
    .toArray()
    .toPromise();
    t.deepEqual(await result, expectedResult);
})


test('getDistinctParameters, returns an distinct parameters from SSM', async t => {
  var {getDistinctParameters} = proxyquire('../index', {
    'aws-sdk': {
      '@noCallThru': true, 
      SSM: function(){
        return { getParameters : (params, cb) => {
            return {
              promise: () => {
                return Promise.resolve(mockParameters)
              }
            }
          }
        }
      }
    }
  });
  var expectedResult = {
      'VAR_1': 'foo',
      'VAR_2': 'bar',
      'VAR_3': 'baz',
      'VAR_4': 'pez'
  }
  
  var result = Rx
    .Observable
    .from(requestedParams)
    .let(getDistinctParameters('test'))
    .toPromise();
    t.deepEqual(await result, expectedResult);
})


test('setupEnvironment, sets up an environment given SSM parameters, calls ', async t => {
  var {setupEnvironment} = proxyquire('../index', {
    'aws-sdk': {
      '@noCallThru': true, 
      SSM: function(){
        return { getParameters : (params, cb) => {
            return {
              promise: () => {
                return Promise.resolve(mockParameters)
              }
            }
          }
        }
      }
    }
  });
  var expectedResult = {
      'VAR_1': 'foo',
      'VAR_2': 'bar',
      'VAR_3': 'baz',
      'VAR_4': 'pez'
  }

  var p = new Promise((res, rej) => {
    setupEnvironment({interval: 100,stage: 'test',parameters: requestedParams},  (env)=>{    
      res(env.VAR_1)
      return () => {};
    })
  })
  t.is(await p, 'foo');
})
