(function (exports) {
    if (typeof print === undefined) print = console.log;

    var PROFILE_CUTOFF = 0.001;
    var currentTime = function () {
        return new Date().getTime();
    };

    var profiles = {
        "<toplevel>" : {
            cumulativeTime: 0,
            selfTime: 0
        }
    };
    var timers = [snapshot()];

    function snapshot(id) {
        return {
            id: id,
            start: currentTime(),
            millisInChildren: 0
        };
    }

    function onObjectAlloc(obj, kind, loc) {
        if (kind === "new" && typeof obj === "function") {
            // new function object created, proxy it
            return function () {
                var args = Array.prototype.slice.apply(arguments);
                onMethodEntry("Function", args, loc);
                var retval = obj.apply(this, args);
                onMethodExit("Function", retval, loc);
                return retval;
            };
        }
    }

    function onMethodEntry(name, args, loc) {
        var s = snapshot(name + " " + loc);
        timers.push(s);
    }

    function onMethodExit(name, retval, loc) {
        var end = currentTime();
        var timer = timers.pop();
        var millis = end - timer.start;
        var fnName = name + " " + loc;

        var isRecursive = false;
        for (var i = timers.length - 1; i >= 0; i--) {
            if (timers[i].id === fnName) {
                isRecursive = true;
                break;
            }
        }

        if (!isRecursive) {
            var prof = profiles[fnName];
            if (!prof) {
                profiles[fnName] = {
                    cumulativeTime: millis,
                    selfTime: (millis - timer.millisInChildren)
                };
            } else {
                prof.cumulativeTime += millis;
                prof.selfTime += (millis - timer.millisInChildren);
            }
        }
        timers[timers.length - 1].millisInChildren += millis;
    }

    function lpad(s, width, pad) {
        if (!pad) pad = " ";
        while (s.length < width) {
            s = pad + s;
        }

        return s;
    }

    function percent(n, d, prec) {
        if (prec === undefined) prec = 1;
        var v = 100.0 * (d === undefined ? n : n /d);

        return v.toFixed(prec) + "%";
    }

    function dumpFunctionProfile(fn, i, functions) {
        var totalMillis = profiles["<toplevel>"].cumulativeTime;
        var prof = profiles[fn];
        var millis = prof.selfTime;
        var selfTimeRatio = millis / totalMillis;
        if (selfTimeRatio < PROFILE_CUTOFF) {
            var remaining = functions.length - i;
            print("+ " + remaining + " more (not shown)");
            return false;
        }

        var selfTime = lpad(percent(selfTimeRatio), 6);
        var cumulTime = lpad(percent(prof.cumulativeTime, totalMillis), 6);

        print(selfTime + "   " + cumulTime + "   " + fn);
        return true;
    }

    exports.esprof$dumpProfile = function () {
        // Update toplevel time
        var endTime = currentTime();
        var timer = timers[0];
        var totalMillis = endTime - timer.start;
        print("Execution: " + (totalMillis / 1000));
        var scriptProf = profiles["<toplevel>"];
        scriptProf.cumulativeTime += totalMillis;
        scriptProf.selfTime += totalMillis - timer.millisInChildren;

        // Profile output
        var functions = Object.keys(profiles);
        functions.sort(function (a,b) { return profiles[b].selfTime - profiles[a].selfTime; });

        print("\n\nProfile\n--------------------------------------------------------------------------------");
        print("[self]   [cumul]   [function]");
        functions.every(dumpFunctionProfile);
        print("--------------------------------------------------------------------------------");


        // Reset so that we can call this function again during the same run
        timer.start = endTime;
        timer.millisInChildren = 0;
    }

    esprof$registerCallbacks({
        onMethodEntry: onMethodEntry,
        onMethodExit: onMethodExit,
        onAlloc: onObjectAlloc
    });
})(this);


