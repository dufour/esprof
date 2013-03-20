var esprima = require('esprima');
var escodegen = require('escodegen');
var estraverse = require('estraverse');
var extend = require('xtend');

var DEFAULT_ES_OPTIONS = {
    loc: true,
    range: true,
    comment: true
};

var EVENTS = [
    "methodEntry",
    "methodExit",
    "alloc",
    "propRead",
    "propWrite",
    "call",
    "functionDefined"
];
exports.EVENTS = EVENTS;

var DEFAULT_OPTIONS = {
    scriptName : "<inline>"
};

EVENTS.forEach(function (e) {
    DEFAULT_OPTIONS[e] = true;
});

var PREFIX = "esprof$";



// -----------------------------------------------------------------------------
//   AST Generation
// -----------------------------------------------------------------------------



function Id(name) {
    return {
        type: "Identifier",
        name: name
    };
}

function Arguments() {
    return Id("arguments");
}

function This() {
    return {
        type: "ThisExpression"
    };
}

function Literal(val) {
    return {
        type: "Literal",
        value: val
    };
}

function Null() {
    return Literal(null);
}

function Undefined() {
    return Id("undefined");
}

function Call(callee /*, ... */) {
    if (typeof callee === "string") callee = Id(callee);
    var params = Array.prototype.slice.call(arguments, 1);

    return {
        type: "CallExpression",
        callee: callee,
        arguments: params
    };
}

function PropRead(obj, prop) {
    if (typeof obj === "string") obj = Id(obj);
    if (typeof prop === "string") prop = Literal(obj);

    return {
        type: "MemberExpression",
        computed: true,
        object: obj,
        property: prop
    };
}

function ArrayExpr(elements) {
    return {
        type: "ArrayExpression",
        elements: elements
    };
}

function ExprStatement(expr) {
    return {
        type: "ExpressionStatement",
        expression: expr
    };
}

function computedPropName(memberExprNode) {
    if (memberExprNode.computed) {
        return memberExprNode.property;
    } else {
        return Literal(memberExprNode.property.name);
    }
}

function lineColumn(loc) {
    return loc.line + "." + loc.column;
}

function loc2str(loc, scriptName) {
    if (!scriptName) scriptName = "?";
    return scriptName + "@" + lineColumn(loc.start) + "-" + lineColumn(loc.end);
}

function functionName(node) {
    return node.id ? node.id.name : "<anonymous>";
}


// -----------------------------------------------------------------------------
//   Instrumentation
// -----------------------------------------------------------------------------


function InstrumentingASTWalker(options) {
    this.options = extend(DEFAULT_OPTIONS, options);
    this.currentFunction = []; // Stack
}

InstrumentingASTWalker.prototype.shouldInstrument = function (event) {
    return !!this.options[event];
};

InstrumentingASTWalker.prototype.genPropRead = function (obj, prop) {
    if (this.shouldInstrument("propRead")) {
        return this.wrapPropRead(obj, prop);
    } else {
        return PropRead(obj, prop);
    }
};

InstrumentingASTWalker.prototype.Loc = function (loc) {
    if (!loc) return Null();
    return Literal(loc2str(loc, this.options.scriptName));
}

InstrumentingASTWalker.prototype.wrapAlloc = function (node, kind) {
    return Call(PREFIX + "onObjectAlloc", node, Literal(kind), this.Loc(node.loc));
};

InstrumentingASTWalker.prototype.wrapPropRead = function (obj, prop, loc) {
    return Call(PREFIX + "onPropRead", obj, prop, this.Loc(loc));
};

InstrumentingASTWalker.prototype.wrapPropWrite = function (obj, prop, value, loc) {
    return Call(PREFIX + "onPropWrite", obj, prop, value, this.Loc(loc));
};

InstrumentingASTWalker.prototype.wrapPropOpWrite = function (obj, prop, value, op, loc) {
    return Call(PREFIX + "onPropOpWrite", obj, prop,
            this.genPropRead(obj, prop), value, Literal(op), this.Loc(loc));
};

InstrumentingASTWalker.prototype.wrapPropUpdate = function (obj, prop, op, loc) {
    return Call(PREFIX + "onPropUpdate", obj, prop, Literal(op), this.Loc(loc));
};

InstrumentingASTWalker.prototype.wrapDirectCall = function (fn, args, loc) {
    return Call(PREFIX + "onDirectCall", This(), fn, ArrayExpr(args), this.Loc(loc));
};

InstrumentingASTWalker.prototype.wrapPropCall = function (obj, prop, args, loc) {
    return Call(PREFIX + "onPropCall", obj, prop, ArrayExpr(args), this.Loc(loc));
};

InstrumentingASTWalker.prototype.wrapReturnExpression = function (expr) {
    var fn = this.currentFunction[this.currentFunction.length - 1];
    if (expr) {
        return Call(PREFIX + "onMethodExit", Literal(functionName(fn)), expr, this.Loc(fn.loc));
    } else {
        return Call(PREFIX + "onMethodExit", Literal(functionName(fn)), Undefined(), this.Loc(fn.loc));
    }
}

InstrumentingASTWalker.prototype.injectEntryCall = function (block, fnName, loc) {
    block.body.unshift(ExprStatement(
            Call(PREFIX + "onMethodEntry", Literal(fnName), Arguments(), this.Loc(loc))
    ));
};

InstrumentingASTWalker.prototype.injectExitCall = function (block, fnName, loc) {
    block.body.push(ExprStatement(
            Call(PREFIX + "onMethodExit", Literal(fnName), Undefined(), this.Loc(loc))
    ));
};

// ---- Traversal -----

InstrumentingASTWalker.prototype.exitArrayExpression = function (node) {
    if (!this.shouldInstrument("alloc")) return node;
    return this.wrapAlloc(node, "[]");
};

InstrumentingASTWalker.prototype.exitNewExpression = function (node) {
    if (!this.shouldInstrument("alloc")) return node;
    return this.wrapAlloc(node, "new");
};

InstrumentingASTWalker.prototype.exitObjectExpression = function (node) {
    if (!this.shouldInstrument("alloc")) return node;
    return this.wrapAlloc(node, "{}");
};

InstrumentingASTWalker.prototype.exitMemberExpression = function (node) {
    if (!this.shouldInstrument("propRead")) return node;
    if (node.isPropertyWrite) return node;
    if (node.isMethodAccess) return node;
    if (node.isUpdateExpression) return node;

    return this.wrapPropRead(node.object, computedPropName(node), node.loc);
};

InstrumentingASTWalker.prototype.enterUpdateExpression = function (node) {
    if (node.argument.type === "MemberExpression") {
        node.argument.isUpdateExpression = true;
    }
    return node;
};

InstrumentingASTWalker.prototype.exitUpdateExpression = function (node) {
    if (!this.shouldInstrument("propRead") && !this.shouldInstrument("propWrite")) return node;

    if (node.argument.type === "MemberExpression") {
        var op = node.prefix ? node.operator + "x" : "x" + node.operator;
        return this.wrapPropUpdate(node.argument.object, computedPropName(node.argument), op, node.loc);
    }

    return node;
};

InstrumentingASTWalker.prototype.enterAssignmentExpression = function (node) {
    if (node.left.type === "MemberExpression") {
        node.left.isPropertyWrite = true;
    }
    return node;
};

InstrumentingASTWalker.prototype.exitAssignmentExpression = function (node) {
    if (!this.shouldInstrument("propWrite")) return node;

    if (node.left.type === "MemberExpression") {
        var prop = computedPropName(node.left);
        if (node.operator !== "=") {
            return this.wrapPropOpWrite(node.left.object, prop, node.right, node.operator.slice(0, -1), node.loc);
        } else {
            return this.wrapPropWrite(node.left.object, prop, node.right, node.loc);
        }
    }

    return node;
};

InstrumentingASTWalker.prototype.enterCallExpression = function (node) {
    if (node.callee.type === "MemberExpression") {
        node.callee.isMethodAccess = true;
    }
    return node;
};

InstrumentingASTWalker.prototype.exitCallExpression = function (node) {
    if (!this.shouldInstrument("call")) return node;

    var fn = node.callee;
    if (fn.type === "MemberExpression") {
        var prop = computedPropName(fn);
        return this.wrapPropCall(node.callee.object, prop, node.arguments, node.loc);
    } else {
        return this.wrapDirectCall(node.callee, node.arguments, node.loc);
    }
};

InstrumentingASTWalker.prototype.exitReturnStatement = function (node) {
    if (!this.shouldInstrument("methodExit")) return node;

    node.argument = this.wrapReturnExpression(node.argument);
    return node;
};

InstrumentingASTWalker.prototype.instrumentFunctionBody = function (node) {
    var fn = functionName(node);
    if (this.shouldInstrument("methodEntry")) {
        this.injectEntryCall(node.body, fn, node.loc);
    }

    if (this.shouldInstrument("methodExit")) {
        this.injectExitCall(node.body, fn, node.loc);
    }
};

InstrumentingASTWalker.prototype.enterScope = function (scope) {
    this.currentFunction.push(scope);
    scope.esprof$decls = [];
};

InstrumentingASTWalker.prototype.exitScope = function (scope) {
    this.currentFunction.pop();
    var body = scope.type === "Program" ? scope.body : scope.body.body;
    for (var i = scope.esprof$decls.length - 1; i >= 0; i--) {
        body.unshift(scope.esprof$decls[i]);
    }
};

InstrumentingASTWalker.prototype.enterFunctionDeclaration = function (node) {
    if (this.shouldInstrument("functionDefined")) {
        var scope = this.currentFunction[this.currentFunction.length - 1];
        scope.esprof$decls.push(ExprStatement(Call(PREFIX + "onFunctionDefined", node.id, this.Loc(node.loc))));
    }
    this.enterScope(node);
};

InstrumentingASTWalker.prototype.exitFunctionDeclaration = function (node) {
    this.instrumentFunctionBody(node);
    this.exitScope(node);
    return node;
};

InstrumentingASTWalker.prototype.enterFunctionExpression = function (node) {
    this.enterScope(node);
};

InstrumentingASTWalker.prototype.exitFunctionExpression = function (node) {
    this.instrumentFunctionBody(node);
    this.exitScope(node);

    if (this.shouldInstrument("functionDefined")) {
        node = Call(PREFIX + "onFunctionDefined", node, this.Loc(node.loc));
    }
    if (this.shouldInstrument("alloc")) {
        node = this.wrapAlloc(node, "function");
    }

    return node;
};

InstrumentingASTWalker.prototype.enterProgram = function (node) {
    this.enterScope(node); // Top-level function
};

InstrumentingASTWalker.prototype.exitProgram = function (node) {
    this.exitScope(node);
    return node;
};

// -----------------------------------------------------------------------------
//   estraverse -> eswalker API
// -----------------------------------------------------------------------------



InstrumentingASTWalker.prototype.enter = function (node) {
    if (node) {
        var f = this["enter" + node.type];
        if (f) {
            return f.call(this, node);
        }
    }

    return node;
};

InstrumentingASTWalker.prototype.leave = function (node) {
    if (node) {
        var f = this["exit" + node.type];
        if (f) {
            return f.call(this, node);
        }
    }

    return node;
};

exports.instrument = function (script, options) {
    var isSource = typeof script === "string";
    var ast = isSource ? esprima.parse(script, DEFAULT_ES_OPTIONS) : script;
    var walker = new InstrumentingASTWalker(options);
    var inst_ast = estraverse.replace(ast, walker);
    return isSource ? escodegen.generate(inst_ast) : inst_ast;
};