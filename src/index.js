import AWS from 'aws-sdk'
import Rx from 'rxjs/Rx';
import { Observable } from 'ava';
const SSM = new AWS.SSM({});

/**
 * Resolves parameter names from 
 * @param {*} stage 
 */
export function resolveParameterNames(stage){
    return (obs) => {
        return obs.map(({name, repo, env}) => ({
            name: `/${repo}/${stage}/${name}`,
            env
        }))
    }
}


/**
 * Given a stream of parameter names get parameters form SSM.
 * 
 * @param {Observable<>} obs list of  strings containing parameters to get from SSM 
 */

export function requestSSMParameters(obs: Observable<>){
    return obs
        .map(ii => ii.name)
        .toArray()
        .flatMap(ii => SSM.getParameters({
                Names: ii,
                WithDecryption: true
            })
            .promise()
        )
        .flatMap(ii => Rx.Observable.from(ii.Parameters))
        .map((ii)=>{ return {name: ii.Name, value: ii.Value}});
}


function getSingleParameter(name){
    SSM
        .getParameter({
            Name: name,WithDecryption: true
        })
        .then(ii => ii.Parameter.Value)
}

function getFnCurrentVarValue(parameters, stage){
    var paramMap = Rx.Observable
        .from(parameters)
        .let(getDistinctParameters(stage))
        .reduce((rr,ii) => {
            rr[ii.env] = ii.name;
            return rr;
        }, {})
        .toPromise()
    return async (env) => {
        var name = (await paramMap)[env];
        return getSingleParameter(name)
    }
}


export function getDistinctParameters(stage: string){

    return (obs) => {
        let parameterNames = obs
            .let(resolveParameterNames(stage))
            .share();
            
        return parameterNames
            .let(requestSSMParameters)
            .concat(parameterNames)
            .groupBy(ii => ii.name)
            .flatMap(ii => ii.reduce((rr, ii) => { 
                rr.name = ii.name;
                rr.value = ii.value || rr.value;
                rr.env = ii.env || rr.env;
                return rr;
            },
            {}))
            .reduce((rr, {env, value, name}) => {
                rr[env] = value
                return rr;
            }, {})
    }
}

export function monitorParams(time, parameters, stage){
    return Rx
        .Observable
        .interval(time)
        .flatMap(ii => 
            Rx.Observable.from(parameters)
                .let(getDistinctParameters(stage))
        )
        .distinctUntilChanged()
}

export class DeferredUpdater {
    constructor() {
        this._promise = new Promise((resolve, reject)=> {
        this.reject = reject
        this.resolve = (ii) => {
            this.value = ii;
            resolve(ii);
        }
        })
        this.promise = () => this._promise.then(() => def.value);
    }
}

export function getVars({interval, stage, parameters}, ){
    const def = new DeferredUpdater();
    monitorParams(interval, parameters, stage)
        .subscribe(ii => def.resolve({
            env: ii
        })
    )
    return def;
}

// Environment can change mid request.

var updateMap = {};

/**
 * setupEnvironment
 * 
 */

export function setupEnvironment({interval, stage, parameters, onUpdate = ()=>{}}, init){
    const def = new DeferredUpdater();
    const monitor = monitorParams(interval, parameters, stage);
    const getCurrentVarValue = getFnCurrentVarValue(parameters, stage);
    monitor.subscribe(ii => def.resolve({
            fn: (() => {
                onUpdate(ii);
                return init(ii, {
                    getCurrentVarValue
                }); 
            })(),
        })
    )
    return (event, context, cb) => def.promise.then(({fn}) => fn(event, context, cb))
}
