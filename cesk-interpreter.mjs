// CESK-interpreter in ES6 JavaScript

// Running
//   node cesk-interpreter.mjs
// Linting
//   npx eslint cesk-interpreter.mjs

import util from 'node:util'
function js_format(x)  { return util.inspect(x,false,null,true) }
function js_write(x)   { console.log(js_format(x)) }
function js_display(x) { console.log(x) }


// TAGS

// Tags are unique values.
// Any value would work.
// The choice below prints nicely.

const symbol_tag             = ["symbol"] 
const number_tag             = ["number"] 
const boolean_tag            = ["boolean"] 
const string_tag             = ["string"]
const pair_tag               = ["pair"]
const closure_tag            = ["closure"]
const primitive_tag          = ["primitive"]
const string_input_port_tag  = ["string_input_port"]  // internal for now
const string_output_port_tag = ["string_output_port"] // internal for now
const continuation_tag       = ["continuation"]
const hash_tag               = ["hash"]

const null_tag               = ["null"]       // These names are useful for debugging,
const void_tag               = ["void"]       // although they could be made singletons.
const singleton_tag          = ["singleton"]  // o_apply, o_callcc

function tag(o) { return o[0] }

// BOOLEANS

const o_true  = [boolean_tag, true]
const o_false = [boolean_tag, false]
function is_boolean(o) { return Array.isArray(o) && (tag(o) === boolean_tag) }
function make_boolean(b) { return ( b === false ? o_false  : o_true ) }

// STRINGS
function is_string(o)      { return Array.isArray(o) && (tag(o) === string_tag) }
function make_string(str)  { return [string_tag, str] }
function string_string(o)  { return o[1] }


// SYMBOLS

const symbol_table = {}  // all interned symbols

function is_symbol(o) { return Array.isArray(o) && (tag(o) === symbol_tag) }

function sym(str) {
    let interned = symbol_table[str]
    return (is_symbol(interned) ? interned : make_symbol(str))
}
function make_symbol(str) {
    let key = Symbol(str)            // used as keys in hash tables
    let val = [symbol_tag, str, key]
    symbol_table[str] = val
    return val
}
function make_uninterned_symbol(str) {
    let key = Symbol(str)            // used as keys in hash tables
    return [symbol_tag, str, key]
}

function o_symbol_to_string(o) {
    return make_string(o[1])
}
function symbol_string(o) { return o[1] }
function symbol_key(o)    { return o[2] }

const begin_symbol            = sym("begin")
const define_symbol           = sym("define")
const if_symbol               = sym("if")
const lambda_symbol           = sym("lambda")
const let_symbol              = sym("let")
const let1_symbol             = sym("let1")
const quote_symbol            = sym("quote")
const quasiquote_symbol       = sym("quasiquote")
const unquote_symbol          = sym("unquote")
const unquote_splicing_symbol = sym("unquote-splicing")

// VOID
const o_void = [void_tag]
function is_void(o) { return o === o_void }

// NULL, PAIRS, LISTS

const o_null = [null_tag]  // unique null value
function is_null(o)     { return o === o_null }
function is_pair(o)     { return Array.isArray(o) && (tag(o) === pair_tag) }

function o_is_pair(o)   { return make_boolean(Array.isArray(o) && (tag(o) === pair_tag)) }
function o_is_null(o)   { return make_boolean(o === o_null) }
function o_cons(o1,o2)  { return [pair_tag, o1, o2] }
function o_car(o)       { return is_pair(o) ? o[1] : fail_expected1("car", "pair", o) }
function o_cdr(o)       { return is_pair(o) ? o[2] : fail_expected1("cdr", "pair", o) }
function set_car(o,a)   { o[1] = a }
function set_cdr(o,d)   { o[2] = d }
function o_set_car(o,a) { o[1] = a ; return o_void }
function o_set_cdr(o,d) { o[2] = d ; return o_void }


function o_list(os)    { return os }

function js_list_length(xs) {
    let n = 0
    while (xs != o_null) {
	n++
	xs = o_cdr(xs)
    }
    return n
}

function o_length(xs)   { return make_number(js_list_length(xs)) }
function o_is_list (xs) { return make_boolean(is_list(xs))}

function is_list(xs) {
    if (xs === o_null)
        return true
    while (is_pair(xs)) {
        xs = o_cdr(xs)
    }
    return (xs === o_null)
}

function array_to_list(axs) {
    let n = axs.length
    let xs = o_null
    for (let i = 0; i<n; i++) {
	xs = o_cons(axs[i],xs)
    }
    return xs
}

function list_to_array(xs) {
    let n   = js_list_length(xs)
    let axs = new Array(n)
    let i = n
    while (!is_null(xs)) {
	axs[--i] = o_car(xs)
	xs = o_cdr(xs)
    }
    return axs
}

function o_append(os) {
    let first = o_null
    let last  = false
    let l = os
    while (   (tag(      l) === pair_tag)
           && (tag(o_cdr(l)) == pair_tag)) {
        // two or more arguments
        let a = o_car(l)
        while ( tag(a) === pair_tag ) {
            let p = o_cons(o_car(a), o_null)
            if (last)
                set_cdr(last,p)
            else
                first = p
            last = p
            a = o_cdr(a)
        }
        if (!(a === o_null))
            error_arg("append", "list",o_car(l))
        l = o_cdr(l)
    }
    if (tag(l) === pair_tag) {
        if (last)
            set_cdr(last, o_car(l))
        else
            first = o_car(l)
    }
    return first
}
                    


// NUMBERS
function is_number(o) { return Array.isArray(o) && (tag(o) === number_tag) }

function make_number(x)  { return [number_tag, x] }
function number_value(o) { return o[1] }
function o_plus(o1, o2)  { return make_number(o1[1] + o2[1]) }
function o_minus(o1, o2) { return make_number(o1[1] - o2[1]) }
function o_mult(o1, o2)  { return make_number(o1[1] * o2[1]) }
function o_is_zero(o)    { return make_boolean( is_number(o) && number_value(o) == 0 ) }

// HASH
//   Mutable hash tables with symbols as keys.
function make_empty_hash() { return [hash_tag, {}] }
function is_hash(o)        { return Array.isArray(o) && (tag(o) === hash_tag) }
function hash_table(o)     { return o[1] }

function o_is_hash(o)      { return make_boolean(is_hash(o)) }

function o_hash_ref(h, sym, def) {
    check("hash-ref", "hash",   is_hash,   h)
    check("hash-ref", "symbol", is_symbol, sym)
    let ht = hash_table(h)
    let key = symbol_key(sym)
    let v = ht[key]
    if (v === undefined) {
        if (def === undefined) 
            throw new Error("key not found")
        return def
    }
    return v
}
function o_hash_set(h, sym, val) {
    check("hash-set!", "hash",   is_hash,   h)
    check("hash-ref",  "symbol", is_symbol, sym)
    let ht = hash_table(h)
    let key = symbol_key(sym)
    ht[key] = val
    return o_void
}
function o_hash_remove(h,sym) {
    check("hash-remove!", "hash",   is_hash,   h)
    check("hash-remove!", "symbol", is_symbol, sym)
    let ht = hash_table(h)
    let key = symbol_key(sym)
    delete ht[key]
    return o_void
}
function o_hash(args) {
    let kvs = args
    while (!(kvs === o_null)) {
        if (!is_symbol(o_car(kvs)))
            throw new Error( "hash: expected a list of interleaved symbols and values" )
        if (o_cdr(kvs) === o_null)
            throw new Error( "hash: missing value for the last key" )
        kvs = o_cdr(o_cdr(kvs))
    }
    kvs = args
    let ht = make_empty_hash()
    while (!(kvs === o_null)) {
        o_hash_set(ht, o_car(kvs), o_car(o_cdr(kvs)))
        kvs = o_cdr(o_cdr(kvs))
    }
    return ht
}

// SINGLETONS

const o_apply       = [singleton_tag]
const o_callcc      = [singleton_tag]
const o_call_prompt = [singleton_tag]

// CLOSURES
function is_closure(o) { return Array.isArray(o) && (tag(o) === closure_tag) }

function make_closure(e, env) {
    return [closure_tag, e, env]
}
function closure_e(o)   { return o[1] }
function closure_env(o) { return o[2] }

// CONTINUATIONS
function is_continuation(o) { return Array.isArray(o) && (tag(o) === continuation_tag) }
function continuation_k(o)  { return o[1] }

// PRIMITIVES
function is_primitive(o) { return Array.isArray(o) && (tag(o) === primitive_tag) }
function make_primitive(name, proc, dispatcher, arity_mask) {
    return [primitive_tag, name, proc, dispatcher, arity_mask]
}
function primitive_name(o)       { return o[1] }
function primitive_proc(o)       { return o[2] }
function primitive_dispatcher(o) { return o[3] }
function primitive_arity_mask(o) { return o[4] }

const MAX_PRIM_ARITY = 10

let registered_prims       = []
let registered_prims_count = 0
function register_primitive(name, proc, dispatcher, arity_mask) {
    let prim = make_primitive(name, proc, dispatcher, arity_mask)
    registered_prims[registered_prims_count++] = prim
    return prim
}
function primitive_to_id(o) {
    for (let i=0; i<registered_prims_count; i++) {
	if (registered_prims[i] === o)
            return i
    }
    panic("could not find primitive")
}
function id_to_primitive(id) {
    return registered_prims[id]
}
function dispatch0(proc, args) {
    return proc()
}
function dispatch1(proc, args) {
    return proc(o_car(args))
}
function dispatch2(proc, args) {
    let result = proc(o_car(args), o_car(o_cdr(args)))
    return result
}
function dispatch3(proc, args) {
    return proc(o_car(args), o_car(o_cdr(args)), o_car(o_cdr(o_cdr(args))))
}
function dispatch23(proc, args) {    
    return proc(o_car(args), o_car(o_cdr(args)),
                (o_cdr(o_cdr(args)) === o_null ? undefined : o_car(o_cdr(o_cdr(args)))))
}
function dispatchn(proc, args) {
    return proc(args)
}




// ERRORS


function fail_expected1(name, type, value) {
    console.log(name + ":")
    console.log("  expected: " + type)
    console.log("  given: " + value)
    throw new Error("^^^^")    
}

function check(name, typename, predicate, value) {
    if (!predicate(value)) 
        fail_expected1(name, typename, value)
}

function panic(msg) {
    throw new Error(msg)
}

function read_error(msg) {
    throw new Error(msg)
}

function error_arity(name, args) {
    console.log(name + ": arity mismatch")
    console.log("   " + args)
    throw new Error("^^^^")
}

function error_arg(name, argument_name, arg) {
    console.log(name + ": ")
    console.log("   expected:" + argument_name)
    console.log("   given:"    + arg)
    throw new Error("^^^^")
}




// JAVASCRIPT TYPES
function is_js_number(o) {
    // Note: Ignores the Number constructor
    return (typeof o) == "number"
}

function is_js_array(o) {
    return Array.isArray(o)
}
    

// PARSE

function parse(s) {
    if (is_js_number(s)) {
	return make_number(s)
    } else if (s === false) {
	return o_false
    } else if (s === true) {
	return o_true
    } else if ( (typeof s) == "string" ) {
	return sym(s)
    } else if (is_js_array(s)) {
	let n = s.length
	let xs = o_null
	for (let i=n-1; i>=0; i--) {
            xs = o_cons( parse(s[i]), xs)
	}
	return xs
    }
}

// CHARACTERS

const whitespace_characters = " \n\t"
function is_whitespace(c) { return !(c===EOF) && !(whitespace_characters.indexOf(c) == -1) }
const digits = "0123456789"
function is_digit(c) { return !(c===EOF) && !(digits.indexOf(c) == -1) }
const letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
function is_letter(c) { return !(c===EOF) && !(letters.indexOf(c) == -1) }
//const special_initials = "!$%&*/:<=.>?^_~"
//function is_special_initial(c) { return !(c===EOF) && !(special_initials.indexOf(c) == -1) }
//function is_initial(c) { return is_letter(c) || is_special_initial(c) }
const delimiters = " \t\n()[]{}\",'`;"
function is_delimiter(c) { return (c===EOF) || !(delimiters.indexOf(c) == -1) }


// STRING PORTS

const EOF = Symbol("EOF")

function make_string_input_port(s)       { return [string_input_port_tag, s,0] }
function string_input_port_string(sp)    { return sp[1] }
function string_input_port_pos(sp)       { return sp[2] }
function set_string_input_port_pos(sp,i) { sp[2] = i }

function make_string_output_port()         { return [string_output_port_tag, [], 0] }
function string_output_port_strings(sp)    { return sp[1] }
function string_output_port_pos(sp)        { return sp[2] }
function set_output_string_port_pos(sp,i)  { sp[2] = i }

// Output
function get_output_string(sp) {
    return string_output_port_strings(sp).join("")
}
function write_string(sp,s) {
    let xs = string_output_port_strings(sp)
    let i = string_output_port_pos(sp)
    xs[i++] = s
    set_output_string_port_pos(sp,i)
    return o_void
}

// Input
function read_char(sp) {
    let s = string_input_port_string(sp)
    let i = string_input_port_pos(sp)
    if (i == s.length)
        return EOF
    else {
        let c = s[i]
        set_string_input_port_pos(sp,i+1)
        return c
    }       
}
function peek_char(sp) {
    let s = string_input_port_string(sp)
    let i = string_input_port_pos(sp)
    if (i == s.length)
        return EOF
    else {
        return s[i]
    }       
}

function back_char(sp) {
    let i = string_input_port_pos(sp)
    if (i == 0)
        return 0
    else {
        set_string_input_port_pos(sp,i-1)
        return i-1
    }       
}

// READING

function skip_whitespace(sp) {
    let c = peek_char(sp)
    while (!(c===EOF) && is_whitespace(c)) {
        read_char(sp)
        c = peek_char(sp)
    }
    return c
}

function skip_comment(sp) {
    let p = peek_char(sp)
    if (p == ";") {
        read_char(sp)
        p = peek_char(sp)
        while (!(p=="\n") && !(p===EOF)) {
            read_char(sp)
            p = peek_char(sp)
        }
        if (p=="\n") 
            read_char(sp)
    }
}

function skip_atmosphere(sp) {
    let p = peek_char(sp)
    while (is_whitespace(p) || p == ";") {
        if (is_whitespace(p))
            skip_whitespace(sp)
        else
            skip_comment(sp)
        p = peek_char(sp)
    }
}
    

// Tokens
const LPAREN = Symbol.for("(")
const RPAREN = Symbol.for(")")
const DOT    = Symbol.for(".")
const QUOTE  = Symbol.for("'")

function lex(sp) {
    skip_atmosphere(sp)
    let c = peek_char(sp)
    // console.log("lex")
    // console.log(c)
    if      (c === EOF)   { return EOF }
    else if (is_digit(c)) { return lex_number(sp) }
    else if (c == "(")    { read_char(sp) ; return LPAREN }
    else if (c == ")")    { read_char(sp) ; return RPAREN }
    else if (c == "'")    { read_char(sp) ; return QUOTE }
    else if (c == "\"")   { return lex_string(sp) }
    else if (c == "+") {
        read_char(sp)
        if (is_digit(peek_char(sp))) {
            return lex_number(sp)
        } else {
            back_char(sp)
            return lex_symbol(sp)
        }        
    } else if (c == "-") {
        read_char(sp)
        if (is_digit(peek_char(sp))) {
            return lex_number(sp,-1)
        } else {
            back_char(sp)
            return lex_symbol(sp)
        }        
    } else if (c == ".") {
        read_char(sp)
        if (is_digit(peek_char(sp))) {
            back_char(sp)
            return lex_number(sp)
        } else {
            // back_char(sp)  XXX
            return DOT
        }
    } else if (c == "#") {
        read_char(sp)
        let p = peek_char(sp)
        if ( (p == "t") || (p = "f") ) {
            return lex_boolean(sp)
        } else {
            back_char(sp)
            return lex_symbol(sp)           
        }
    } else if (c == "`") {
        read_char(sp)
        return quasiquote_symbol
    } else if (c == ",") {
        read_char(sp)
        if (peek_char(sp) == "@") {
            read_char(sp)
            return unquote_splicing_symbol
        } else
            return unquote_symbol
    } else {
        return lex_symbol(sp)
    }
}

function lex_boolean(sp) {
    let c = read_char(sp)
    if (c == "t") {
        if (is_delimiter(peek_char(sp))) {
            return make_boolean(true)
        } else {
            read_error("bad syntax '#t" + peek_char(sp) + "'") 
        }
    } else if (c == "f") {
        if (is_delimiter(peek_char(sp))) {
            return make_boolean(false)
        } else {
            read_error("bad syntax '#f" + peek_char(sp) + "'")
        }
    } else {
        throw Error("lex_boolean: internal error")
    }
}


function lex_number(sp,factor) {
    // console.log("lex_number")
    let d = read_char(sp)
    let ds = [d]
    let i = 1
    while (is_digit(peek_char(sp))) {
        ds[i++] = read_char(sp)
    }
    if (peek_char(sp)==".") {
        ds[i++] = read_char(sp)
        while (is_digit(peek_char(sp))) {
            ds[i++] = read_char(sp)
        }
    }    
    let n = Number.parseFloat(ds.join(""))
    return make_number((factor === undefined) ? n : -n)
}

function lex_symbol(sp) {
    // console.log("lex_symbol")
    let c = read_char(sp)
    let cs = [c]
    let i = 1
    while (!is_delimiter(peek_char(sp)) && !(peek_char(sp)===EOF)) {
        cs[i++] = read_char(sp)
    }
    return sym(cs.join(""))
}

function lex_string(sp) {
    let c  = read_char(sp) // the "
    let cs = []
    let i  = 0
    while (true) {
        let c = read_char(sp)
        if (c === "\\") {
            let p = peek_char(sp)
            if      (p === "t")  { read_char(sp); cs[i++] = "\t" }
            else if (p === "n" ) { read_char(sp); cs[i++] = "\n" }
            else if (p === "\\") { read_char(sp); cs[i++] = "\\" }
            else if (p === EOF)  { throw new Error("read: end-of-file object occurred while reading a string") }
            else                 { read_char(sp); cs[i++] = p    }
        } else if (c === "\"") {
            return make_string(cs.join(""))
        } else {
            cs[i++] = c
        }
    }
}

function o_reverse(o) {
    let r = o_null
    while (!is_null(o)) {
        r = o_cons(o_car(o), r)
        o = o_cdr(o)
    }
    return r
}

function reverse_star(o, last_cdr) {
    let r = last_cdr
    while (!is_null(o)) {
        r = o_cons(o_car(o), r)
        o = o_cdr(o)
    }
    return r
}

//  <program>    ::= <s> ...
//  <s>          ::= <atom>
//                |  (<s> ...) 
//                |  (<s> ... . <s>) 
//                |  '<s>

// https://docs.racket-lang.org/zuo/reader.html

function parse_tokens(tokens) {
    // "input port" of tokens
    // js_write(tokens)
    let i = 0
    let n = tokens.length
    const EOT = Symbol("End of tokens")
    function peek () { return (i<n ? tokens[i] : EOT ) }
    function skip () { if (i<n) i++ }
    function read () { return (i<n ? tokens[i++] : EOT ) }
    function done () { return i>=n }
    // output        
    let out = o_null // accumulator
    // Stack of commands
    let stack   = []
    let stack_i = 0
    function push(cmd)          { stack[stack_i++] = [cmd,false]; }
    function pushout(cmd)       { stack[stack_i++] = [cmd,out]; out = o_null }
    function pushdata(cmd,data) { stack[stack_i++] = [cmd,data]; }
    function pop()              { return stack[--stack_i] }
    function is_stack_empty()   { return stack_i === 0 }

    push( "program" )
    while(!is_stack_empty()) {
        // js_display("--")
        // js_write(out)
        // js_write(stack)
        let inst = pop()
        let cmd  = inst[0]
        let data = inst[1]
        // js_display(cmd)

        if (cmd == "program") {
            if (peek() === EOT) 
                return o_reverse(out)
            push("program")
            push("s")
        } else if (cmd == "s") {
            let t = read()
            
            if (t === LPAREN) {
                if (peek() === DOT) 
                    throw new Error("parse_tokens: unexpected .")
                pushout("list_suffix")
            } else if (t === RPAREN) {
                throw new Error("parse_tokens: unexected )")
            } else if (t === DOT) {
                throw new Error("parse_tokens: unexpected .")
            } else if (t === QUOTE) {
                pushout("quote")
                push("s")
            } else {
                out = o_cons( t, out )
            }
        } else if (cmd == "quote") {
            out = o_cons( o_cons(quote_symbol, out), data )
        } else if (cmd == "list_suffix") {
            let t = read()
            if (t === EOT) {
                throw new Error("unexpected end of tokens")
            } else if (t === RPAREN) {
                out = o_cons( o_reverse(out), data )
            } else if (t === LPAREN) {
                if (peek() === DOT)
                    throw new Error("parse_tokens: ( followed by .")
                pushdata("list_suffix",data)
                pushout("list_suffix")
            } else if (t === DOT) {
                pushdata("list*_suffix",data)
            } else if (t === QUOTE) {
                console.log("list quote")
                pushout("list_suffix")
                push("quote")
                push("s")
            } else {
                out = o_cons( t, out )
                pushdata("list_suffix",data)
            }
        } else if (cmd == "list*_suffix") {
            let t = read()
            if (t === EOT) {
                throw new Error("unexpected end of tokens")
            } else if (t === RPAREN) {
                throw new Error("unexpected )")
            } else if (t === LPAREN) {
                if (peek() === RPAREN) {
                    read()
                    out = o_cons( reverse_star(out, o_null), data )
                    if (!(peek() === RPAREN))
                        throw new Error("parse_tokens: ) expected")
                    read()
                } else {
                    throw new Error("unexpected (")
                }
            } else if (t === DOT) {
                throw new Error("unexpected .")
            } else if (t === QUOTE) {
                console.log("list* quote")
                pushdata("list*_suffix",data)
                pushout("quote")
                push("s")
            } else {
                out = o_cons( reverse_star(out, t), data )
                if (!(peek() === RPAREN))
                    throw new Error("parse_tokens: ) expected")
                read()
            }
        } else {
            throw new Error("parse_tokens: internal error - unknown command")
        }
    }    
    if (is_stack_empty()) {
        return o_reverse(out)
    } else {
        throw new Error("parse_tokens: unclosed parenthesis detected")
    }
}
        
            
function read_from_string(s) {
    let sp = make_string_input_port(s)
    let tokens = []
    let i = 0
    let t = lex(sp)
    // console.log(t)
    while (!(t === EOF)) {
        tokens[i++] = t
        t = lex(sp)
        // console.log(t)
    }
    return tokens
}

// WRITING

// const pair_tag               = ["pair"]

// const string_input_port_tag  = ["string_input_port"]  // internal for now
// const string_output_port_tag = ["string_output_port"] // internal for now

function format_symbol  (o) { return symbol_string(o) }
function format_number  (o) { return number_value(o).toString() }
function format_boolean (o) { return (o === o_false ? "#f" : "#t") }
function format_string  (o) { return "\"" + string_string(o) + "\"" }


function is_atom (o) {
    let t = tag(o)
    return (t == symbol_tag)    
        || (t == number_tag)    
        || (t == boolean_tag)   
        || (t == string_tag)    
        || (t == closure_tag)   
        || (t == primitive_tag)  
        || (t == continuation_tag)
        || (t == hash_tag)
        || (o === o_null)          
        || (o === o_void)           
        || (o === o_apply)          
        || (o === o_callcc)         
        || (o === o_call_prompt)
}


function format_atom (o) {
    let t = tag(o)
    if      (t == symbol_tag)         { return format_symbol(o)   }
    else if (t == number_tag)         { return format_number(o)   }
    else if (t == boolean_tag)        { return format_boolean(o)  }
    else if (t == string_tag)         { return format_string(o)   }
    else if (t == closure_tag)        { return "#<procedure>"     }
    else if (t == primitive_tag)      { return "#<procedure:" + primitive_name(o) +  ">" }
    else if (t == continuation_tag)   { return "#<continuation>" }
    else if (t == hash_tag)           { return "#<hash>" }        
    else if (o === o_null)            { return "()" }
    else if (o === o_void)            { return "#<void>" }
    else if (o === o_apply)           { return "#<procedure:apply>" }
    else if (o === o_callcc)          { return "#<procedure:call/cc>" }
    else if (o === o_call_prompt)     { return "#<procedure:call/prompt" }
    else
        throw new Error("format_atom: expected atom, got: " + js_format(o))
}

    

function format(o,mode) {
    // Output string
    let sp = make_string_output_port()       
    // Stack of commands
    let stack   = []
    let stack_i = 0
    function push(cmd)          { stack[stack_i++] = [cmd,false]; }
    function pushdata(cmd,data) { stack[stack_i++] = [cmd,data]; }
    function pop()              { return stack[--stack_i] }
    function is_stack_empty()   { return stack_i === 0 }

    push("datum")    
    while(!is_stack_empty()) {
        // js_display("--")
        // js_write(get_output_string(sp))
        // js_write(o)
        // js_write(stack)

        let inst = pop()
        let cmd  = inst[0]
        let data = inst[1]

        if (cmd === "datum") {
            if(is_atom(o)) {
                write_string(sp, format_atom(o))
            } else if (is_pair(o)) {
                write_string(sp, "(")
                pushdata("tail", o_cdr(o))
                o = o_car(o)
                push("datum")
            }            
        } else if (cmd === "tail") {
            o = data
            if (is_pair(o)) {
                write_string(sp," ")
                pushdata("tail", o_cdr(o))
                o = o_car(o)
                push("datum")
            } else if (o === o_null) {
                write_string(sp,")")
            } else if (is_atom(o)) {
                write_string(sp, " . ")                
                write_string(sp, format_atom(o))
                write_string(sp, ")")
                o = data
            }
        }
    }
    return get_output_string(sp)
}


    



// ENVIRONMENT

function make_empty_env() {
    return []
}

function extend_env(env, sym, value) {
    return [[sym,value], env]
}

function lookup(env,sym) {
    while (!(env.length == 0)) {
	let e = env[0]
	if (e[0] === sym) {
            return e[1]
	}
	env = env[1]
    }
    return undefined
}

// TOP-LEVEL

let top_level = new WeakMap()

function extend_top_level(sym, o) {
    top_level.set(sym, o)
}

function lookup_top_level(sym) {
    return top_level.get(sym)
}

function reset_top_level () {
    top_level = new WeakMap()
}

// Continuations

const done_k   = Symbol("done_k")
const define_k = Symbol("define_k")
const if_k     = Symbol("if_k")
const begin_k  = Symbol("begin_k")
const let1_k   = Symbol("let1_k")
const apply_k  = Symbol("apply_k")

const o_done_k = [done_k, false, false, false] // sentinel
o_done_k[2] = o_done_k                         

function cont_type(k) { return k[0] } // one of the above symbols
function cont_data(k) { return k[1] } // dependent of continuation type
function cont_next(k) { return k[2] }  
function cont_env(k)  { return k[3] }

function set_cont_data(k,d)  { k[1] = d }
function set_cont_next(k,k1) { k[2] = k1 }


// STATE
// C = Control     (an expression)
// E = Environment (id -> binding)
// S = Storage
// K = Continuation
// M = Meta Continuation

function state_e(s)   { return s[0] }
function state_v(s)   { return s[0] }
function state_env(s) { return s[1] }
function state_mem(s) { return s[2] }
function state_k(s)   { return s[3] }
function state_m(s)   { return s[4] } // list of (cons tag continuation)

function set_state_k(s,k) { s[3] = k }
function set_state_m(s,k) { s[4] = k }

// inject a program into a state
function inject(expression) {
    return [expression, initial_env, false, o_done_k, o_null]
}


function step( s ) {
    let e   = state_e(s)
    let env = state_env(s)
    let v   = undefined

    while (v === undefined ) {
	if  (is_boolean(e) || is_number(e) || is_string(e) || is_null(e) || is_void(e) || is_continuation(e)) {
            v = e
	} else if (is_symbol(e)) {
            v = lookup(env, e)
            if (v === undefined) {
                v = lookup_top_level(e)
                if (v === undefined) {
                    throw new Error("undefined: " + symbol_string(e))
                }
            }
	} else if (is_pair(e)) {
            let rator = o_car(e)
            if (rator === quote_symbol) {
                v = o_car(o_cdr(e))
            } else if (rator === define_symbol) {
                // (define id expr)
                let id = o_car(o_cdr(e))
                let e0 = o_car(o_cdr(o_cdr(e)))
                e = e0
                let new_k = [define_k, id, state_k(s), env]
                set_state_k(s,new_k)
            } else if (rator === if_symbol) {
                let e0 = o_car(o_cdr(e))
                let e1 = o_car(o_cdr(o_cdr(e)))
                let e2 = o_car(o_cdr(o_cdr(o_cdr(e))))
                e = e0
                let new_k = [if_k, [e1, e2], state_k(s), env]
                set_state_k(s,new_k)
            } else if (rator === lambda_symbol) {
                v = make_closure(e, env)
            } else if (rator === begin_symbol) {
                let e0 = o_car(o_cdr(e))
                let es = o_cdr(o_cdr(e))
                e = e0
                if (!is_null(es)) {
                    let k = state_k(s)
                    let new_k = [begin_k, es, k, env]
                    set_state_k(s, new_k)
                }
            } else if (rator === let1_symbol) {
                // (let1 x e0 e1)
                let x  = o_car(o_cdr(e))
                let e0 = o_car(o_cdr(o_cdr(e)))
                let e1 = o_car(o_cdr(o_cdr(o_cdr(e))))
                e = e0
                let new_k = [let1_k, [x,e1], state_k(s), env]
                set_state_k(s, new_k)
            } else {
                // (e0 e ...)
                let e0 = o_car(e)
                let new_k = [apply_k, [o_null,o_cdr(e)], state_k(s), env]
                e = e0
                set_state_k(s, new_k)
            }
        } else {
            console.log(e)
            throw new Error("application: not a procedure")
        }
    }
    s[0] = v
    return s
}

function continue_step(s) {
    let k = state_k(s)
    let t = cont_type(k)
    if (t === apply_k) {
	let d = cont_data(k) // [reverse_vals,exprs]
	let rev_vals = d[0]
	let es = d[1]
	rev_vals = o_cons(state_v(s), rev_vals)
	if (!is_null(es)) {
            let e     = o_car(es)
            let env   = cont_env(k)
            let new_k = [apply_k, [rev_vals,o_cdr(es)], cont_next(k), env]	    
            set_state_k(new_k)
            return [e,state_env(s),state_mem(s),new_k,state_m(s)]
	} else {
            let args = o_null
            let count = 0     // invariant: count = args.length
            while (!is_null(rev_vals)) {
                args = o_cons(o_car(rev_vals), args)
                count++
                rev_vals = o_cdr(rev_vals)
            }
            let rator = o_car(args)
            args = o_cdr(args)
            count--
            while (true) { // loop in case of apply                
                // console.log("continue")
                // console.log(js_list_length(state_m(s)))
                // console.log("meta_k")
                // console.log(state_m(s))
                // console.log("k")
                // console.log(state_k(s))
                
                // console.log(tag(rator))
                // console.log(rator)
                let rator_tag = tag(rator)
                if (rator === o_apply) {
                    // (apply rator args)
                    if (!(js_list_length(args)==2))
                        error_arity("apply", args)                    
                    rator = o_car(args)
                    args  = o_car(o_cdr(args))
                    count = js_list_length(args)
                    if (!is_list(args))
                        error_arg("apply", "list", args)                        
                    // no break => we loop and handle the new rator and args
                } else if (rator === o_callcc) {
                    // console.log("call/cc")
                    // console.log(cont_next(state_k(s)))
                    if (!(count == 1))
                        error_arity("callcc", args)
                    rator = o_car(args)
                    args  = o_cons([continuation_tag, cont_next(state_k(s))], o_null)
                    // no break => loop to call the callcc argument with the continuation
                } else if (rator === o_call_prompt) {
                    console.log("call/prompt")
                    // (call/prompt proc tag)
                    if (!(count == 2))
                        error_arity("call_prompt", args)
                    rator     = o_car(args)
                    let ptag  = o_car(o_cdr(args))
                    if (!(tag(ptag) === symbol_tag))
                        throw new Error("call/prompt: tag not a symbol")
                    args  = o_null
                    count = 0
                    set_state_m(s, o_cons( o_cons(cont_next(state_k(s)), ptag), 
                                           state_m(s)))
                    set_state_k(s, o_done_k)
                    // no break => loop to call the proc argument
                } else if (rator_tag === primitive_tag) {
                    // console.log(primitive_name(rator))
                    let f          = rator
                    let dispatcher = primitive_dispatcher(f)
                    let proc       = primitive_proc(f)
                    let mask       = primitive_arity_mask(f)
                    if (!( mask & ( 1 << ((count >= MAX_PRIM_ARITY) ? MAX_PRIM_ARITY : count) ) ))
                        throw new Error(   primitive_name(f) + ": arity mismatch;\n"
                                         + "  the expected number of arguments doesn't match the given number\n"
                                        // + "   expected: " arity_mask_to_string(mask)"
                                         + "     given: " + count)
                    let v          = dispatcher(proc, args)
                    return [o_cons(quote_symbol, o_cons(v, o_null)),
                            state_env(s), state_mem(s), cont_next(state_k(s)), state_m(s)]
                } else if (rator_tag === closure_tag) {
                    // console.log("closure")
                    let all_args = args
                    let ce       = closure_e(rator)         // (lambda formals body)
                    let cenv     = closure_env(rator)
                    let formals  = o_car(o_cdr(ce))         // id or (id ...) or (id ... . more)
                    let body     = o_car(o_cdr(o_cdr(ce)))

                    while (is_pair(formals)) {
                        // if (is_null(args)) { break }
                        cenv    = extend_env(cenv, o_car(formals), o_car(args))
                        args    = o_cdr(args)
                        formals = o_cdr(formals)
                    }
                    if (is_symbol(formals)) {
                        cenv = extend_env(cenv, formals, args)
                    } else if ( (!is_null(formals)) || (!is_null(args)) ) {
                        fail_arity(rator, all_args)
                    }                       
                    return [body,cenv,state_mem(s),cont_next(state_k(s)),state_m(s)]
                } else if (rator_tag === continuation_tag) {
                    let k   = continuation_k(rator)
                    let arg = o_car(args)
                    return [o_cons(quote_symbol, o_cons(arg, o_null)), 
                            state_env(s), state_mem(s), k, state_m(s)]
                } else {
                    // todo: throw an interpreter exception
                    console.log("------")
                    console.log(rator)
                    throw new Error("application: not a procedure")
                }
            }
        }	
    } else if (t === if_k) {
	let d     = cont_data(k)
        let e     = ( state_v(s) == o_false) ? d[1] : d[0]
	let new_k = cont_next(k)
	let env   = cont_env(k)
	return [e,state_env(s),state_mem(s),new_k,state_m(s)]
    } else if (t === begin_k) {
	let d = cont_data(k)
	let e = o_car(d)
	let next = cont_next(k)
	let new_k = is_null(o_cdr(d)) ? next : [begin_k, o_cdr(d), next, state_env(s)]
	return [e,state_env(s),state_mem(s),new_k,state_m(s)]
    } else if (t === let1_k) {
	let v    = state_v(s)
	let d    = cont_data(k) 
	let x    = d[0]
	let e1   = d[1]
	let env1 = extend_env(cont_env(k), x, v)
	return [e1, env1, state_mem(s), cont_next(k),state_m(s)]
    } else if (t === define_k) {
        let v = state_v(s)
        let x = cont_data(k)
        extend_top_level(x,v)
        return [o_cons(quote_symbol, o_cons(o_void, o_null)),
                state_env(s),state_mem(s),cont_next(k),state_m(s)]
    } else if (t === done_k) {
	return s
    } else {
        console.log("//////")
	console.log(k)
        throw new Error("continue_step: unhandled continuation type")
    }    
}

function core_eval(expr) {
    let initial_state = inject(expr)
    let s = initial_state
    while (true) {	
	step(s)
	if (state_k(s) === o_done_k) {
            if (state_m(s) === o_null) { 
                return state_v(s)
            } else {
                // console.log("core_eval: discarding tag form meta continuations")
                set_state_k(s,o_car(o_car(state_m(s))))
                set_state_m(s,o_cdr(state_m(s)))
            }
	}
	s = continue_step(s)
    }
}


//
// TESTS
//

function test_booleans() {
    let t1 = is_boolean(o_true)
    let t2 = is_boolean(o_false)
    let t3 = !is_string(o_true)
    return t1 && t2 && t3
}

function test_strings() {
    let foo = make_string("foo")
    let bar = make_string("bar")

    let t1 = is_string(foo) && is_string(bar)
    let t2 = (!is_string(42)) && (!is_symbol(foo))
    let t3 = tag(foo) === string_tag
    // console.log([t1,t2,t3,t4,t5,t6])
    return t1 && t2 && t3
}

function test_null_and_pairs() {
    let t1 = is_null(o_null)
    let t2 = !is_null(o_cons(o_null,o_null))
    let t3 = is_pair(o_cons(o_true,o_false))
    let t4 = o_car(o_cons(o_true,o_false)) == o_true
    let t5 = o_cdr(o_cons(o_true,o_false)) == o_false
    let t6 = js_list_length(array_to_list([11,22,33])) == 3
    let a7 = list_to_array(array_to_list([11,22,33]))
    let t7 = (a7[0] == 11) && (a7[1] == 22) && (a7[2] == 33)
    let t8 = !is_list( o_cons(1,2) )
    let t9 =  is_list( o_cons(1,o_null) )
    // console.log([t1,t2,t3,t4,t5,t6,t7,t8,t9])
    return t1 && t2 && t3 && t4 && t5 && t6 && t7 && t8 && t9
}

function test_symbols() {
    let foo  = sym("foo")
    let foo1 = sym("foo")
    let foo2 = sym("foo")
    let bar  = sym("bar")
    let foo3 = make_uninterned_symbol("foo")
    // all tests are supposed to be true
    let t1 = is_symbol(foo)
    let t2 = is_symbol(bar)
    let t3 = ( tag(foo) == symbol_tag )
    let t4 = (foo === foo1) &&  (foo1 == foo2);
    let t5 = !(foo === bar)
    let t6 = !(is_symbol( [number_tag, 42] ))
    let t7 = is_symbol(foo3)
    let t8 = !(foo == foo3)
    let t9 = o_symbol_to_string(foo)[1] == "foo"
    // console.log([t1,t2,t3,t4,t5,t6])
    return t1 && t2 && t3 && t4 && t5 && t6 && t7 && t8 && t9
}

// TEST ENVIRONMENTS
function test_environments() {
    let foo  = sym("foo")
    let bar  = sym("bar")
    let mt   = make_empty_env()
    let t1   = lookup(mt,foo) === undefined
    let e0   = make_empty_env()
    let e1   = extend_env(e0, foo, 42)
    let e2   = extend_env(e1, bar, 43)
    let t2   = lookup(e2,foo) === 42
    let t3   = lookup(e2,bar) === 43
    // console.log([t1,t2,t3])
    return t1 && t2 && t3
}

function test_hashes() {
    let h = make_empty_hash()
    let foo = sym("foo")
    let bar = sym("bar")
    o_hash_set(h, foo, 42)
    let t1 = o_hash_ref(h, foo) === 42
    o_hash_set(h, foo, 43)
    let t2 = o_hash_ref(h, foo) === 43
    o_hash_set(h, bar, 44)
    let t3 = o_hash_ref(h, foo) === 43 
    let t4 = o_hash_ref(h, bar) === 44

    let h2 = o_hash(o_cons(foo, o_cons(42, o_cons(bar, o_cons(43, o_null)))))
    let t5 = o_hash_ref(h2, foo) === 42
    let t6 = o_hash_ref(h2, bar) === 43
    
    return t1 && t2 && t3 && t4 && t5 && t6
}

function test_string_output_ports() {
    let sp = make_string_output_port()
    write_string(sp, "foo")
    write_string(sp, "bar")
    let t1 = get_output_string(sp) == "foobar"    
    return t1
}


console.log("Booleans")
console.log(test_booleans())
console.log("Strings")
console.log(test_strings())
console.log("Symbols")
console.log(test_symbols())
console.log("Null and Pairs")
console.log(test_null_and_pairs())
console.log("Environments")
console.log(test_environments())
console.log("Hashes")
console.log(test_hashes())
console.log("String Output Ports")
console.log(test_string_output_ports())

function parse1(str) {
    return o_car(parse_tokens(read_from_string(str)))
}

let expr0  = parse( 42 )
let expr1  = parse( "fortytwo" )
let expr2  = parse( ["if", true,  42, 43] )
let expr3  = parse( ["if", false, 42, 43] )
let expr4  = parse( ["begin", 41, 42, 43] )
let expr5  = parse( ["if", ["begin", 41, 42, 43],    11, 22] )  // => 11
let expr6  = parse( ["if", ["begin", 41, 42, false], 11, 22] )  // => 22
let expr7  = parse( ["if", ["begin", 41, 42, 43],
                           ["begin", 11, 22],
                           ["begin", 33, 44]] )  // => 22
let expr8  = parse( ["let1", "x", 42, "x"] ) // => 42
let expr9  = parse( ["let1", "x", 42, "y"] ) // => error
let expr10 = parse( ["quote", 42] ) // => 42
let expr11 = parse( ["lambda", ["x"], 42] )
let expr12 = parse( ["cons", 41, 42] )
let expr13 = parse( "cons" )
let expr14 = parse( [["lambda", ["x"], ["cons", "x", 43]], 42] )
let expr15 = parse( [["lambda", "x", "x"], 42, 43, 44] )
let expr16 = o_void
let expr17 = parse( ["define", "x", 42] )
let expr18 = parse( ["begin", ["define", "x", 42], "x"] )
let expr19 = parse( ["begin", ["define", "plus1", ["lambda", ["x"], ["+", "x", 1]]],
                     ["plus1", 41]] )
let expr20 = parse( ["zero?", 0] ) // => true
let expr21 = parse( ["zero?", 1] ) // => false
let expr22 = parse( ["-", 5, 1] )  // => 4
let expr23 = parse( ["*", 2, 3] )  // => 6
let expr24 = parse( ["if", ["zero?", 0], 41, 42] ) // => 41 
let expr25 = parse( ["if", ["zero?", 1], 41, 42] ) // => 42 

let expr26 = parse( ["begin", ["define", "fact", ["lambda", ["x"], 
                                                  ["if", ["zero?", "x"],
                                                   1,
                                                   ["*", "x", ["fact", ["-", "x", 1]]]]]],
                     ["fact", 5]] )

/*
let expr27 = parse1("(apply + (cons 1 (cons 2 null)))")
let expr28 = parse1("(call/cc (lambda (x) x))")            // => some continuation
let expr29 = parse1("(call/cc (lambda (k) (k 42)))")       // => 42
let expr30 = parse1("(call/cc (lambda (k) (+ 1 (k 42))))") // => 42
let expr31 = parse1("(call/prompt (lambda () 10) (quote tag))")   // => 10
let expr32 = parse1("(let1 k (call/prompt (lambda () (call/cc (lambda (k) k)))  \
                                          (quote tag))                          \
                       (+ 1 (call/prompt (lambda () (k 11))                    \
                                         (quote tag))))")   // => 12
let expr33 = parse1("(call/prompt (lambda () (call/cc (lambda (k) k))) (quote tag))")
let expr34 = parse1("((call/prompt (lambda () (call/cc (lambda (k) k))) (quote tag)) list)")
let expr35 = parse1("(call/cc (lambda (k) k))")
let expr36 = parse1("((call/cc (lambda (k) k)) list)")
let expr37 = parse1("(list 1 2 3)")
*/
// let expr38 = parse1("(hash-ref (hash 'foo 42 'bar 43 )  'foo)")
// let expr39 = parse1("(hash-ref (hash 'foo 42 'bar 43 )  'qux 44)")
// let expr40 = parse1("(let1 h (hash 'foo 42 'bar 43) (begin (hash-set! h 'foo 45) (hash-ref h 'foo)))")
//let expr41 = parse1("(zero? 0)")

//let exprs1 = [expr0,expr1,expr2,expr3,expr4,expr5,expr6,expr7,expr8,expr9]
//let exprs2 = [expr10,expr11,expr12,expr13,expr14,expr15,expr16,expr17,expr18,expr19]
//let exprs3 = [expr20,expr21,expr22,expr23,expr24,expr25,expr26,expr27,expr28,expr29]
// let exprs4 = [expr30,expr31,expr32,expr33,expr34,expr35,expr36,expr37,expr38,expr39]
// let exprs5 = [expr40] // ,expr31,expr32,expr33,expr34,expr35,expr36,expr37,expr38,expr29]
// let exprs_all = [exprs1,exprs2,exprs3,exprs4,exprs5]

// console.log(top_env)

// Primitives
function primitive0(name, proc)       { return register_primitive(name, proc, dispatch0,   1<<0)}
function primitive1(name, proc)       { return register_primitive(name, proc, dispatch1,   1<<1)}
function primitive2(name, proc)       { return register_primitive(name, proc, dispatch2,   1<<2)}
function primitive3(name, proc)       { return register_primitive(name, proc, dispatch3,   1<<3)}
function primitive23(name, proc)      { return register_primitive(name, proc, dispatch23, (1<<2) | (1<<3))}
function primitiven(name, proc, mask) { return register_primitive(name, proc, dispatchn,   mask)}
// mask  1+2 = 1 or 2 arguments
// mask  1   exactly 1 argument
// maske 0   no arguments
// mask -1 = any number
// mask -2 = 1 or more

let initial_env = make_empty_env()

initial_env = extend_env(initial_env, sym("pair?"),   primitive1("pair?",   o_is_pair))
initial_env = extend_env(initial_env, sym("null?"),   primitive1("null?",   o_is_null))
initial_env = extend_env(initial_env, sym("list?"),   primitive1("list?",   o_is_list))
initial_env = extend_env(initial_env, sym("cons"),    primitive2("cons",    o_cons))
initial_env = extend_env(initial_env, sym("car"),     primitive1("car",     o_car))
initial_env = extend_env(initial_env, sym("cdr"),     primitive1("cdr",     o_cdr))
initial_env = extend_env(initial_env, sym("list"),    primitiven("list",    o_list, -1))
initial_env = extend_env(initial_env, sym("append"),  primitiven("append",  o_append, -1))
initial_env = extend_env(initial_env, sym("reverse"), primitive1("reverse", o_reverse))


initial_env = extend_env(initial_env, sym("+"),           primitive2("+",          o_plus))
initial_env = extend_env(initial_env, sym("-"),           primitive2("-",          o_minus))
initial_env = extend_env(initial_env, sym("*"),           primitive2("*",          o_mult))
initial_env = extend_env(initial_env, sym("zero?"),       primitive1("zero?",      o_is_zero))

initial_env = extend_env(initial_env, sym("list?"),       primitive1("list?",      o_is_list))
initial_env = extend_env(initial_env, sym("hash?"),       primitive1("hash?",      o_is_hash))
initial_env = extend_env(initial_env, sym("hash"),        primitiven("hash",       o_hash, -1))
initial_env = extend_env(initial_env, sym("hash-ref"),    primitive23("hash-ref",  o_hash_ref))
initial_env = extend_env(initial_env, sym("hash-set!"),   primitive3("hash-set!",  o_hash_set))


// Singletons
initial_env = extend_env(initial_env, sym("null"),        o_null)
// Special procedures
initial_env = extend_env(initial_env, sym("apply"),       o_apply)
initial_env = extend_env(initial_env, sym("call/cc"),     o_callcc)
initial_env = extend_env(initial_env, sym("call/prompt"), o_call_prompt)


// console.log( read_from_string( " ( foo bar 43 baz + +3 -10 -a - 10. 11.1 12.34 .34 .bar ..4 ... #t #f oo ' ` , ,@ )"))

//let expr42 = parse1("(let1 h (hash 'foo 42 'bar 43) 44)")
//js_write(expr42)
//js_display(format(expr42))
//js_display(format(core_eval(expr42)))


//let expr43 = parse1("(a 'b)")
// js_write(expr43)
//js_display(format(expr43))


let expr42 = parse1("(pair? 42)")
let expr43 = parse1("(pair? (cons 1 2))")

let expr44 = parse1("(null? null)")
let expr45 = parse1("(null? 42)")

let expr46 = parse1("(list? null)")
let expr47 = parse1("(list? 42)")
let expr48 = parse1("(list? (cons 11 null))")
let expr49 = parse1("(list? (cons 11 (cons 22 null)))")
let expr50 = parse1("(list? (cons 11 (cons 22 33)))")

let expr51 = parse1("(append)")
let expr52 = parse1("(append (list 11 22))")
let expr53 = parse1("(append (list 11 22) (list 33 44))")
let expr54 = parse1("(append (list 11 22) (list 33 44) (list 55 66))")
let expr55 = parse1("(append (list 11 22) (list 33 44) (list 55 66) 77)")

let expr56 = parse1("(reverse (reverse (list 11 22 33)))")

js_display(format(core_eval(expr56)))
//js_display(format(core_eval(expr52)))
//js_display(format(core_eval(expr53)))
//js_display(format(core_eval(expr54)))
//js_display(format(core_eval(expr55)))


