var inst = require('./instrument');

function reexport(module, into) {
    var dest = into || {};
    for (var key in module) {
        if (module.hasOwnProperty(key)) {
            if (exports.hasOwnProperty(key)) {
                throw "Name clash in reexport!";
            }
            dest[key] = module[key];
        }
    }
    return dest;
}

reexport(inst, exports);
