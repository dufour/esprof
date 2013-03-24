(function () {
    var indent = 0;

    function indentString() {
        var s = "|- ";
        for (var i = 0; i < indent; i++) {
            s = "|--" + s;
        }
        return s;
    }

    function onObjectAlloc(e, obj, kind, loc) {
        if (kind === "new" && typeof obj === "function") {
            // new function object created, proxy it
            return function () {
                var args = Array.prototype.slice.apply(arguments);
                onMethodEntry("<Function>", args, loc);
                var retval = obj.apply(this, args);
                onMethodExit("<Function>", retval, loc);
                return retval;
            };
        }
    }

    function onMethodEntry(e, name, args, loc) {
        print(indentString() + name + " (" + loc + ")");
        indent += 1;
    }

    function onMethodExit(e, name, retval, loc) {
        indent -= 1;
    }

    esprof.on("methodEntry", onMethodEntry);
    esprof.on("methodExit", onMethodExit);
    esprof.on("alloc", onObjectAlloc);
})();


