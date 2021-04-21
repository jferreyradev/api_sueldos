const database = require('../services/database');
const oracledb = require('oracledb');
const { startup } = require('oracledb');

function getSQLcall(sp) {
    let sqlCab = 'BEGIN ' + sp.sp_name + '(';
    let first = true;
    for (const key in sp.in_param) {
        if (first) {
            first = false;
        } else {
            sqlCab += ', ';
        }
        sqlCab += ':' + key;
    }
    if (sp['out_param']) {
        for (const key in sp.out_param) {
            sqlCab += ', :' + key;
        }
    }

    sqlCab += '); END;';

    /*
    const val = sp.out_param['varName'] ? ':' + sp.out_param['varName'] : null;
    const err = sp.out_param['varErrorName'] ? ':' + sp.out_param['varErrorName'] : null;
    const cur = sp.out_param['cursor'] ? ':' + sp.out_param['cursor'] : null;
    if (val) {
        sqlCab += ', ' + val;
    }
    if (err) {
        sqlCab += ', ' + err;
    }
    if (cur) {
        sqlCab += ', ' + cur;
    }
    sqlCab += '); END;';
    */
    //console.log(sqlCab);

    return sqlCab;
}

function getSQLbinds(context, sp) {
    const binds = context;

    for (const key in context) {
        binds[key] = context[key];
    }

    if (sp['out_param']) {
        for (const key in sp.out_param) {
            if (key!='cursor'){
                binds[key] = { dir: oracledb.BIND_OUT };
            }else{
                binds[key] = { type: oracledb.CURSOR, dir: oracledb.BIND_OUT };        
            }            
        }
    }

    /*
    if (sp.out_param['varName']) {
        binds[sp.out_param.varName] = { dir: oracledb.BIND_OUT };
    }

    if (sp.out_param['varErrorName']) {
        binds[sp.out_param.varErrorName] = { dir: oracledb.BIND_OUT };
    }

    if (sp.out_param['cursor']) {
        binds[sp.out_param.cursor] = { type: oracledb.CURSOR, dir: oracledb.BIND_OUT };
    }
    */

    return binds;
}

async function execStoreProcedure(context, sp) {
    let query = getSQLcall(sp);
    let binds = getSQLbinds(context, sp);

    //console.log(query);
    //console.log(binds);

    let result = {}
    let json = {}

    const status = sp['log'] ? sp.log['status'] : false;

    //console.log(status);

    const start = new Date().now;

    if (status) {

        let idnum = 0;

        const seq = await database.simpleExecute(`SELECT logproc_seq.nextval FROM dual`);

        idnum = Number.parseInt(seq['rows'][0].NEXTVAL);

        const res = await database.simpleExecute(
            `INSERT INTO logproc(ID, INICIO, SP, FIN, QUERY, BINDS, OUTPUT, TIPO) 
                    VALUES (:vid, :vinicio, :vsp, null, :vquery, :vbinds, NULL, :tipo)`,
            {
                vid: idnum,
                vsp: sp.sp_name,
                vinicio: new Date(),
                vquery: query,
                vbinds: JSON.stringify(binds),
                tipo: sp.log['type']
            }
        );

        result = await database.simpleExecute(query, binds);

        const res2 = await database.simpleExecute(
            `UPDATE logproc set fin=:vfin where id = :vid`,
            {
                vfin: new Date(),
                vid: idnum
            }
        )

    } else {

        result = await database.simpleExecute(query, binds);

    }

    const millis = Date.now() - start;

    json = { status: 200, params: binds, out: result.outBinds, elapsed: Math.floor(millis / 1000) };

    //console.log(json.out.cursor);
    //console.log(result);

    //console.log(res);

    return json;

}

module.exports.getSQLcall = getSQLcall;
module.exports.getSQLbinds = getSQLbinds;
module.exports.execStoreProcedure = execStoreProcedure;