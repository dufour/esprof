var esprima = require('esprima');
var escodegen = require('escodegen');
var estraverse = require('estraverse');

var ES_OPTIONS = {
    loc: true,
    range: true,
    comment: true
};

function InstrumentingASTWalker() {
    /* empty */
}

InstrumentingASTWalker.prototype.wrapObjectCreation = function (node) {
    return {
        type: "CallExpression",
        callee: {
            type : "Identifier",
            name : "onObjectAlloc"
        },
        arguments: [
            node
        ]
    };
};

InstrumentingASTWalker.prototype.wrapPropRead = function (obj, prop) {
    return {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "onPropRead"
        },
        arguments: [
            obj,
            prop
        ]
    };
};

InstrumentingASTWalker.prototype.wrapPropWrite = function (obj, prop, value) {
    return {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "onPropWrite"
        },
        arguments: [
            obj,
            prop,
            value
        ]
    };
};

InstrumentingASTWalker.prototype.wrapPropOpWrite = function (obj, prop, value, op) {
    return {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "onPropOpWrite"
        },
        arguments: [
            obj,
            prop,
            {
                type: "CallExpression",
                callee: {
                    type: "Identifier",
                    name: "onPropRead"
                },
                arguments: [
                    obj,
                    prop
                ]
            },
            value,
            {
                type: "Literal",
                value: op
            }
        ]
    };
};

InstrumentingASTWalker.prototype.wrapPropUpdate = function (obj, prop, op) {
    return {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "onPropUpdate"
        },
        arguments: [
            obj,
            prop,
            {
                type: "Literal",
                value: op
            }
        ]
    };
};

InstrumentingASTWalker.prototype.wrapDirectCall = function (fn, args) {
    return {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "onDirectCall"
        },
        arguments: [
            {
                type: "ThisExpression"
            },
            fn,
            {
                type: "ArrayExpression",
                elements: args
            }
        ]
    };
};

InstrumentingASTWalker.prototype.wrapPropCall = function (obj, prop, args) {
    return {
        type: "CallExpression",
        callee: {
            type: "Identifier",
            name: "onPropCall"
        },
        arguments: [
            obj,
            prop,
            {
                type: "ArrayExpression",
                elements: args
            }
        ]
    };
};

InstrumentingASTWalker.prototype.exitArrayExpression = function (node) {
    return this.wrapObjectCreation(node);
};

InstrumentingASTWalker.prototype.exitNewExpression = function (node) {
    return this.wrapObjectCreation(node);
};

InstrumentingASTWalker.prototype.exitObjectExpression = function (node) {
    return this.wrapObjectCreation(node);
};

InstrumentingASTWalker.prototype.exitMemberExpression = function (node) {
    if (!node.isPropertyWrite && !node.isMethodAccess && !node.isUpdateExpression) {
        var prop = node.computed ? node.property : {type: "Literal", value: node.property.name};
        return this.wrapPropRead(node.object, prop);
    }

    return node;
};

InstrumentingASTWalker.prototype.enterUpdateExpression = function (node) {
    if (node.argument.type === "MemberExpression") {
        node.argument.isUpdateExpression = true;
    }
    return node;
};

InstrumentingASTWalker.prototype.exitUpdateExpression = function (node) {
    if (node.argument.type === "MemberExpression") {
        var prop = node.argument.computed ? node.argument.property : {type: "Literal", value: node.argument.property.name};
        var op = node.prefix ? node.operator + "x" : "x" + node.operator;
        return this.wrapPropUpdate(node.argument.object, prop, op);
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
    if (node.left.type === "MemberExpression") {
        var prop = node.left.computed ? node.left.property : {type: "Literal", value: node.left.property.name};
        if (node.operator !== "=") {
            return this.wrapPropOpWrite(node.left.object, prop, node.right, node.operator.slice(0, -1));
        } else {
            return this.wrapPropWrite(node.left.object, prop, node.right);
        }
    }
    return node;
}

InstrumentingASTWalker.prototype.enterCallExpression = function (node) {
    if (node.callee.type === "MemberExpression") {
        node.callee.isMethodAccess = true;
    }
    return node;
};

InstrumentingASTWalker.prototype.exitCallExpression = function (node) {
    var fn = node.callee;
    if (fn.type === "MemberExpression") {
        var prop = fn.computed ? fn.property : {type: "Literal", value: fn.property.name};
        return this.wrapPropCall(node.callee.object, prop, node.arguments);
    } else {
        return this.wrapDirectCall(node.callee, node.arguments);
    }
    return node;
};

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
    if (options === undefined) options = {};

    var ast = typeof script === "string" ? esprima.parse(script, ES_OPTIONS) : script;
    var walker = new InstrumentingASTWalker(options);
    var inst_ast = estraverse.replace(ast, walker);
    return typeof script === "string" ? escodegen.generate(inst_ast) : inst_ast;
};