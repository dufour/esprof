(function () {
    var indent = 0;

    function indentString() {
        var s = "|- ";
        for (var i = 0; i < indent; i++) {
            s = "|--" + s;
        }
        return s;
    }

    function onObjectAlloc(obj, kind, loc) {
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

    function onMethodEntry(name, args, loc) {
        print(indentString() + name + " (" + loc + ")");
        indent += 1;
    }

    function onMethodExit(name, retval, loc) {
        indent -= 1;
    }

    esprof$registerEvents({
        onMethodEntry: onMethodEntry,
        onMethodExit: onMethodExit,
        onAlloc: onObjectAlloc
    });
})();


