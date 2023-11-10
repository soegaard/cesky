// CEK-interpreter in ES6 JavaScript

// TODO
//  [x] fix bug in hash-count (or hash_extend)
//  [ ] multiple arguments for +, -, * 


// TODO
//  [x] Use uninterned JavaScript symbol for tag
//  [ ] Add source location to tokens.
//  [ ] Implement more primitives
//  [/] Port lib/
//  [ ] Command line arguments
//  [ ] Produce single file from library files and cesky.mjs for the browser.
//  [ ] Documentation
//  [ ] Name: `rac` (aka a small racket), `cesky` ?
//  [ ] Actual string ports?
//  [ ] FFI for JavaScript

// Running
//   node cesky.mjs

// Linting
//   npx eslint cesky.mjs

import util      from 'node:util'
import * as fs   from 'node:fs'      // for readFileSync()
import * as os   from 'node:os'      // for platform()
import * as path from 'node:path'    // for isAbsolute()
import { cwd, stdin, stdout, stderr }  from 'node:process'


function js_format(x)  { return util.inspect(x,false,null,true) }
function js_write(x)   { console.log(js_format(x)) }
function js_display(x) { console.log(x) }

// TAGS

// Tags are unique values.
// Any value would work.
// The choice below prints nicely.

const symbol_tag             = Symbol("symbol")
const number_tag             = Symbol("number")
const boolean_tag            = Symbol("boolean")
const string_tag             = Symbol("string")
const pair_tag               = Symbol("pair")
const closure_tag            = Symbol("closure")
const primitive_tag          = Symbol("primitive")
const string_input_port_tag  = Symbol("string_input_port")  // internal for now
const string_output_port_tag = Symbol("string_output_port") // internal for now
const continuation_tag       = Symbol("continuation")
const hash_tag               = Symbol("hash")
//const trie_tag               = ["trie"]
const variable_tag           = Symbol("variable")
const opaque_tag             = Symbol("opaque")

const null_tag               = Symbol("null")       // These names are useful for debugging,
const void_tag               = Symbol("void")       // although they could be made singletons.
const singleton_tag          = Symbol("singleton")  // o_apply, o_callcc

function tag(o) { return o[0] }

// BOOLEANS

const o_true  = [boolean_tag, true]
const o_false = [boolean_tag, false]
function is_boolean(o) { return Array.isArray(o) && (tag(o) === boolean_tag) }
function make_boolean(b) { return ( b === false ? o_false  : o_true ) }

// STRINGS
function make_string(str)   { return [string_tag, str] }
function string_string(o)   { return o[1] }

function is_string(o)       { return              Array.isArray(o) && (tag(o) === string_tag)  }
function o_is_string(o)     { return make_boolean(Array.isArray(o) && (tag(o) === string_tag)) }

function string_length(o)   { return             string_string(o).length }
function o_string_length(o) { return make_number(string_string(o).length) }

function o_string_ref(o,i)  {
    let idx = check_string_index("string-ref",o,i);
    return make_number(string_string(o).charCodeAt(idx))
}
function o_string(os) {
    let cs = list_to_array(os)
    let ns = cs.map( (x) => number_value(x) )
    return make_string(String.fromCharCode.apply(null, ns))
}
function o_substring(o,start,end) {
    let who = "substring"
    check_string(who,o)
    let i = check_string_index(who,o,start)
    if (end === undefined)
        return make_string(string_string(o).substring(i))    
    else {
        let j = check_string_index(who,o,end)
        if (j<i)
            fail( who + ": ending index is smaller than start index, got: " + i + " and " + j)
        return make_string(string_string(o).substring(i,j))
    }    
}
function o_string_equal(o1,o2) {
    let who = "string=?"
    check_string(who,o1)
    check_string(who,o2)
    return make_boolean(string_string(o1) == string_string(o2))
}
function o_string_ci_equal(o1,o2) {
    let who = "string-ci=?"
    check_string(who,o1)
    check_string(who,o2)
    return make_boolean(string_string(o1).toLowerCase() == string_string(o2).toLowerCase())
}
function o_string_lt(o1,o2) {
    let who = "string<?"
    check_string(who,o1)
    check_string(who,o2)
    return make_boolean(string_string(o1) < string_string(o2))
}
function o_string_split(o1,o2) {
    let who = "string-split"
    check_string(who,o1)
    if (o2 === undefined)
        return array_to_list(string_string(o1).split(" ").map(make_string))
    else {
        check_string(who,o2)
        return array_to_list(string_string(o1).split(string_string(o2)).map(make_string))
    }
}
    

function check_string_index(who,o,i) {
    check_string(who,o)
    check_integer(who,i)
    let n = o[1].length
    let idx = number_value(i)
    if(!( (0 <= idx) && ( idx < n)))
        fail(who + ": index out of bounds for string, got " + format(o) + " and " + idx)
    return idx
}
function check_integer(who, o) {
    let t = tag(o)
    if (! (t === number_tag))        
        fail(who + ": expected integer, got " + format(o))
    let n = number_value(o)
    if (!Number.isInteger(n))
        fail(who + ": expected integer, got ", n)
}

function o_string_to_symbol(o) {
    check_string("string->symbol", o)
    return sym(o[1])
}
function o_string_to_uninterned_symbol(o) {
    check_string("string->uninterned-symbol", o)
    return make_uninterned_symbol(o[1])
}

// SYMBOLS

const symbol_table = {}  // all interned symbols
let   symbol_counter = 0

function   is_symbol(o) { return              Array.isArray(o) && (tag(o) === symbol_tag)  }
function o_is_symbol(o) { return make_boolean(Array.isArray(o) && (tag(o) === symbol_tag)) }

function sym(str) {
    let interned = symbol_table[str]
    return (is_symbol(interned) ? interned : make_symbol(str))
}
function make_symbol(str) {
    let key = Symbol(str)            // used as keys in mutable hash tables
    let val = [symbol_tag, str, key, symbol_counter++]
    symbol_table[str] = val
    return val
}
function symbol_string(o) { return o[1] }
function symbol_key(o)    { return o[2] }
function symbol_id(o)     { return o[3] }

function make_uninterned_symbol(str) {
    let key = Symbol(str)            // used as keys in hash tables
    return [symbol_tag, str, key]
}

function o_symbol_to_string(o) {
    return make_string(o[1])
}

const begin_symbol            = sym("begin")
const define_symbol           = sym("define")
const if_symbol               = sym("if")
const lambda_symbol           = sym("lambda")
const let_symbol              = sym("let")
const quote_symbol            = sym("quote")
const quasiquote_symbol       = sym("quasiquote")
const unquote_symbol          = sym("unquote")
const unquote_splicing_symbol = sym("unquote-splicing")

// VOID
const o_void = [void_tag]
function is_void(o)   { return o === o_void }
function o_void_f(o)  { return o_void }
function o_is_eq(o1,o2) {
    return (o1 === o2) ? o_true : o_false
}
function o_not(o) {
    return (o === o_false) ? o_true : o_false
}

const o_undefined = [singleton_tag, "undefined"]
function is_undefined(o)   { return o === o_undefined }
function o_is_undefined(o) { return make_boolean(o === o_undefined) }

const o_eof = [singleton_tag, "eof"]
function is_eof(o)   { return o === o_eof }
function o_is_eof(o) { return make_boolean(o === o_eof) }

// VARIABLES

function o_make_variable(sym) {
    check_symbol("variable", sym)
    return [variable_tag, sym, o_undefined]
}
function variable_name(o)        { return o[1] }
function variable_value(o)       { return o[2] }
function set_variable_value(o,v) { o[2]=v }

function is_variable(o)   { return              Array.isArray(o) && (tag(o) === variable_tag)  }
function o_is_variable(o) { return make_boolean(Array.isArray(o) && (tag(o) === variable_tag)) }

function o_variable_set(o, val) {
    if (!is_variable(o))
        fail_expected1("variable-set!", "variable", o)
    if (variable_value(o) !== o_undefined)
        throw new Error("variable already has a value")
    set_variable_value(o,val)
    return o_void
}
function o_variable_ref(o) {
    if (!is_variable(o))
        fail_expected1("variable-ref", "variable", o)
    let val = variable_value(o)
    if (val === o_undefined) 
        throw new Error("undefined: " + format(variable_name(o)))
    return val
}


// NULL, PAIRS, LISTS

const o_null = [null_tag]  // unique null value
function is_null(o)     { return o === o_null }
function is_pair(o)     { return Array.isArray(o) && (tag(o) === pair_tag) }

function o_is_pair(o)   { return make_boolean(Array.isArray(o) && (tag(o) === pair_tag)) }
function o_is_null(o)   { return make_boolean(o === o_null) }
function o_cons(o1,o2)  { return [pair_tag, o1, o2] }
function car(o)         { return o[1] }  // unsafe
function cdr(o)         { return o[2] }  // unsafe
function o_car(o)       {
    if (is_pair(o))
        return o[1]
    else {
        js_write(o)
        fail_expected1("car", "pair", o)
    }
}
//    return is_pair(o) ? o[1] : fail_expected1("car", "pair", o)

function o_cdr(o)       { return is_pair(o) ? o[2] : fail_expected1("cdr", "pair", o) }
function set_car(o,a)   { o[1] = a }
function set_cdr(o,d)   { o[2] = d }
function o_set_car(o,a) { o[1] = a ; return o_void }
function o_set_cdr(o,d) { o[2] = d ; return o_void }
function o_list(os)     { return os }

function list(...os) {
    let xs = o_null
    for (const o of os.reverse()) {
        xs = o_cons(o, xs)
    }
    return xs
}

function o_length(xs)   { return make_number(js_list_length(xs)) }
function js_list_length(xs) {
    let n = 0
    while (xs != o_null) {
	n++
	xs = o_cdr(xs)
    }
    return n
}

function o_is_list (xs) {
    return make_boolean(is_list(xs))
}
function is_list(xs) {
    if (xs === o_null)
        return true
    while (is_pair(xs)) {
        xs = o_cdr(xs)
    }
    return (xs === o_null)
}

function o_list_ref(xs,index) {
    if (!is_number(index))
        throw new Error("list-ref: not a non-negative integer")
    let i = number_value(index)
    if (i<0)
        throw new Error("list-ref: not a non-negative integer" + i)
    while ((i>0) && (tag(xs) == pair_tag)) {
        xs = o_cdr(xs)
        i--
    }
    if (!(tag(xs) === pair_tag))
        throw new Error("list-ref: found a non-pair: " + format(xs))
    return o_car(xs)
}

function o_list_set(xs, index, value) {
    if (!is_number(index))
        throw new Error("list-set: not a non-negative integer")
    let i = number_value(index)
    if (i<0)
        throw new Error("list-set: not a non-negative integer" + i)
    if ( (i===0) && (tag(xs) == pair_tag))
        return o_cons(value, o_cdr(xs))
    let first = false
    let last  = false
    while ((i>0) && (tag(xs) == pair_tag)) {
        let p = o_cons(o_car(xs), o_null)
        if (!first)
            first = p
        else
            set_cdr(last,p)
        last = p
        xs = o_cdr(xs)
        i--
    }
    if (!(tag(xs) === pair_tag))
        throw new Error("list-set: found a non-pair: " + format(xs))
    set_cdr(last,o_cons(value, o_cdr(xs)))
    
    return first
}


function array_to_list(axs) {
    let n = axs.length
    let xs = o_null
    for (let i = n-1; i>=0; i--) {
	xs = o_cons(axs[i],xs)
    }
    return xs
}

function list_to_array(xs) {
    let n   = js_list_length(xs)
    let axs = new Array(n)
    let i = 0
    while (!is_null(xs)) {
	axs[i++] = o_car(xs)
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
function is_number(o)   { return              Array.isArray(o) && (tag(o) === number_tag)  }
function o_is_number(o) { return make_boolean(Array.isArray(o) && (tag(o) === number_tag)) }

function make_number(x)   { return [number_tag, x] }
function number_value(o)  { return o[1] }
function o_plus(o1, o2)   { return make_number(o1[1] + o2[1]) }
function o_minus(o1, o2)  { return make_number(o1[1] - o2[1]) }
function o_mult(o1, o2)   { return make_number(o1[1] * o2[1]) }
function o_div(o1, o2)    { return make_number(o1[1] / o2[1]) }
function o_modulo(o1, o2) { return make_number( ((o1[1] % o2[1]) + o2[1]) % o2[1]) }
function o_remainder(o1, o2) { return make_number(o1[1] % o2[1]) }
function o_quotient(o1, o2)  { return make_number(Math.floor(o1[1] / o2[1])) }


function o_is_zero(o)    { return make_boolean( is_number(o) && number_value(o) == 0 ) }

function o_eql(o1,o2) {
    check_numbers("=", o1, o2)
    return (number_value(o1) === number_value(o2) ? o_true : o_false)
}
function o_lt(o1,o2) {
    check_numbers("<", o1, o2)
    return (number_value(o1) < number_value(o2) ? o_true : o_false)
}
function o_le(o1,o2) {
    check_numbers("<=", o1, o2)
    return (number_value(o1) <= number_value(o2) ? o_true : o_false)
}
function o_gt(o1,o2) {
    check_numbers(">", o1, o2)
    return (number_value(o1) > number_value(o2) ? o_true : o_false)
}
function o_ge(o1,o2) {
    check_numbers(">=", o1, o2)
    return (number_value(o1) >= number_value(o2) ? o_true : o_false)
}

function o_bitwise_and(o1,o2) {
    check_numbers("bitwise-and", o1, o2)
    return make_number(number_value(o1) & number_value(o2))
}
function o_bitwise_ior(o1,o2) {
    check_numbers("bitwise-ior", o1, o2)
    return make_number(number_value(o1) | number_value(o2))
}
function o_bitwise_xor(o1,o2) {
    check_numbers("bitwise-xor", o1, o2)
    return make_number(number_value(o1) ^ number_value(o2))
}
function o_bitwise_not(o) {
    check_number("bitwise-not", o)
    return make_number( ~ number_value(o) )
}

// TRIES (aka HASH TABLES)

// The tries are symbol-keyed persistent maps.

const TRIE_BFACTOR_BITS = 4
const TRIE_BFACTOR      = (1<<TRIE_BFACTOR_BITS)
const TRIE_BFACTOR_MASK = (TRIE_BFACTOR-1)

function make_trie(count, key, val, next) {
    return [hash_tag, count, key, val, next]
    // next is an array of length TRIE_BFACTOR or o_undefined
}
function is_trie(o)    { return              Array.isArray(o) && (tag(o) === hash_tag)  }
function o_is_trie(o)  { return make_boolean(Array.isArray(o) && (tag(o) === hash_tag)) }

function trie_count(o) { return o[1] }
function trie_key(o)   { return o[2] }
function trie_value(o) { return o[3] }
function trie_next(o)  { return o[4] }

function increment_trie_count(o) { o[1] += 1 }
function decrement_trie_count(o) { o[1] -= 1 }
function add_to_trie_count(o,a)  { o[1] += a }
function set_trie_key(o,k)       { o[2]  = k }
function set_trie_value(o,v)     { o[3]  = v }

function make_empty_trie() {
    let next = Array(TRIE_BFACTOR)
    next.fill(o_undefined)
    return make_trie(0, o_undefined, o_undefined, next)
}
const o_empty_hash = make_empty_trie()
function trie_lookup(trie, id) {
    // id is an integer
    while (id > 0) {
        trie = trie_next(trie)[id & TRIE_BFACTOR_MASK]
        if (trie === o_undefined)
            return o_undefined
        id = id >> TRIE_BFACTOR_BITS
    }
    return trie_value(trie)
}
function o_trie_lookup(t, sym) {
    return trie_lookup(t, symbol_id(sym))
}
function trie_set(trie, id, key, val) {
    let next = false
    while (id > 0) {
        next = trie_next(trie)[id & TRIE_BFACTOR_MASK]
        if (next === o_undefined) {
            next = make_empty_trie()
            trie_next(trie)[id & TRIE_BFACTOR_MASK] = next
            trie = next
        } else 
            trie = next
        id = id >> TRIE_BFACTOR_BITS
    }
    set_trie_key(trie, key)
    set_trie_value(trie, val)
}
function o_trie_set(trie, sym, val) {
    // TODO: Uncomment the following two debug lines
    //let old = o_trie_lookup(trie, sym)
    //if (old !== o_undefined) throw new Error("attempt to mutate trie")
    trie_set(trie, symbol_id(sym), sym, val)
    increment_trie_count(trie)
    return trie
}
function trie_clone(trie) {
    const count = trie_count(trie)
    const key   = trie_key(trie)
    const val   = trie_value(trie)
    const next  = trie_next(trie)
    return make_trie(count, key, val, next)
}
function trie_extend(trie, id, key, val, added_box) {
    // added is an array with one element
    let new_trie = false
    if (trie === o_undefined) {
        new_trie = make_empty_trie()
        trie = new_trie
        added_box[0] = 1
    } else 
        new_trie = trie_clone(trie)

    if (id>0) {
        let i = id & TRIE_BFACTOR_MASK
        trie_next(new_trie)[i] = trie_extend(trie_next(trie)[i],
                                             id >> TRIE_BFACTOR_BITS,
                                             key, val, added_box)
        add_to_trie_count(new_trie, added_box[0])
    } else {
        if (trie_value(new_trie) === o_undefined)
            added_box[0] = 1
        add_to_trie_count(new_trie, added_box[0])
        set_trie_key(new_trie, key)
        set_trie_value(new_trie, val)
    }
    return new_trie
}
function o_trie_extend(trie, sym, val) {
    let added_box = [0]
    return trie_extend(trie, symbol_id(sym), sym, val, added_box)
}
function trie_keys(trie_in, accum) {
    let i = 0
    let trie = trie_in
    if (trie_key(trie) !== o_undefined)
        accum = o_cons(trie_key(trie), accum)

    for (i = 0; i < TRIE_BFACTOR; i++) {
        if (trie_next(trie)[i] !== o_undefined)
            accum = trie_keys(trie_next(trie)[i], accum)
    }
    return accum
}
function trie_remove(trie, id, depth) {
    let new_trie

    if (trie === o_undefined)
        return o_undefined;
    else if (id > 0) {
        let i = id & TRIE_BFACTOR_MASK
        let sub_trie = trie_remove(trie_next(trie)[i], id >> TRIE_BFACTOR_BITS, depth+1)
        if (sub_trie === trie_next(trie)[i])
            return trie

        new_trie = trie_clone(trie)
        trie_next(trie)[i] = sub_trie
        decrement_trie_count(new_trie)
        
        if ((sub_trie !== o_undefined)
            || (trie_value(new_trie) !== o_undefined))
            return new_trie;
    } else {
        if (trie_value(trie) === o_undefined)
            return trie

        new_trie = trie_clone(trie)
        decrement_trie_count(new_trie)
        set_trie_key(new_trie, o_undefined)
        set_trie_value(new_trie, o_undefined)
    }

    if (depth > 0) {
        let i = 0
        for (i = 0; i < TRIE_BFACTOR; i++)
            if (trie_next(new_trie)[i] !== o_undefined)
                return new_trie
        return o_undefined;
    }
  return new_trie
}
function o_trie_remove(trie, sym) {
    return trie_remove(trie, symbol_id(sym), 0)
}
function trie_is_keys_subset(trie1_in, trie2_in) {
    if (trie1_in === trie2_in)
        return true
    else if (trie1_in === o_undefined)
        return false
    else if (trie2_in === o_undefined)
        return false
    else {
        let trie1 = trie1_in;
        let trie2 = trie2_in;
        let i

        if (trie_count(trie1) > trie_count(trie2))
            return false

        for (i = 0; i < TRIE_BFACTOR; i++) {
            if (!trie_is_keys_subset(trie_next(trie1)[i], trie_next(trie2)[i]))
                return false
        }

        return true
    }
}
function o_hash(args) {
    let kvs = args
    while (kvs !== o_null) {
        if (!is_symbol(o_car(kvs)))
            throw new Error( "hash: expected a list of interleaved symbols and values" )
        if (o_cdr(kvs) === o_null)
            throw new Error( "hash: missing value for the last key" )
        kvs = o_cdr(o_cdr(kvs))
    }
    kvs = args
    let ht = make_empty_trie()
    while (kvs !== o_null) {
        ht = o_trie_extend(ht, car(kvs), car(cdr(kvs)))
        kvs = cdr(cdr(kvs))  
    }
    return ht
}
function o_hash_count(ht) {
    check_hash("hash-count", ht)
    return make_number(trie_count(ht))
}
function o_hash_ref(o, sym, defval) {
    const who = "hash-ref"
    check_hash(who, o)
    check_symbol(who, sym)
    let v = o_trie_lookup(o, sym)
    if (v === o_undefined) {
        if (defval === o_undefined) 
            throw new Error(who + ": key is not present, key:" + format(sym))
        v = defval
    }
    return v
}
function o_hash_set(o, sym, val) {
    const who = "hash-set"
    check_hash(who, o)
    check_symbol(who, sym)
    return o_trie_extend(o, sym, val)
}
function is_hash(o) {
    return is_trie(o)
}
function o_is_hash(o) {
    return make_boolean(is_trie(o))
}
function o_hash_remove(ht, sym) {
    const who = "hash-remove"
    check_hash(who, ht)
    check_symbol(who, sym)
    return o_trie_remove(ht, sym)
}
function o_hash_keys(o) {
    const who = "hash-keys"
    check_hash(who, o)
    return trie_sorted_keys(o, o_null)
}
function trie_sorted_keys(trie_in, accum) {
    return symbol_list_sort(trie_keys(trie_in, accum))
}
function symbol_list_sort(syms) {
    let as = list_to_array(syms)
    function compare (s, t) {
        let s1 = symbol_string(s)
        let t1 = symbol_string(t)        
        if (s1 === t1)
            return 0
        else if (s1 < t1)
            return -1
        else
            return 1
    }
    as = as.sort(compare)
    return array_to_list(as)
}
function o_is_hash_keys_subset(ht, ht2) {
    const who = "hash-keys-subset?"
    check_hash(who, ht)
    check_hash(who, ht2)
    return trie_is_keys_subset(ht, ht2) ? o_true : o_false;
}



/*  Mutable Hashes

//   Mutable hash tables with symbols as keys.
function is_hash(o)        { return Array.isArray(o) && (tag(o) === hash_tag) }
function hash_table(o)     { return o[1] }
function make_empty_hash() { return [hash_tag, {}] }

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


*/


// OPAQUE

function o_opaque(key, val)      { return [opaque_tag, key, val] }
function opaque_key(o)           { return o[1] }
function opaque_value(o)         { return o[2] }
function set_opaque_value(o,v)   { o[2]=v }

function is_opaque(o)   { return              Array.isArray(o) && (tag(o) === opaque_tag)  }
function o_is_opaque(o) { return make_boolean(Array.isArray(o) && (tag(o) === opaque_tag)) }

function o_opaque_ref(key, obj, defval) {
    if (tag(obj) === opaque_tag) {
        if (opaque_key(obj) === key)
            return opaque_value(obj)
    }
    return defval
}



// MODULES

let o_modules = o_null  // list of (cons module-path module)
                        // where module-path is a symbol or string and
                        // module is a hash table
let o_pending_modules = o_null // list of module-paths  (for cycle detection)

function o_is_module_path(o) {
    if (is_symbol(o)) {
        let s = symbol_string(o)
        let n = s.length
        if ( (n === 0) || (s[0]==="/") || (s[n-1]==="/") )
            return o_false
        if (s.includes("//"))
            return o_false
        return (/^[a-zA-Z0-9/_+-]*$/.test(s)) ? o_true : o_false
    } else if (is_string(o)) {
        let s = string_string(o)
        let n = s.length
        if (n === 0)
            return o_false
        return o_true
    } else
        throw new Error("module-path?: expected a symbol or a string path")
}

function o_is_path_string(o) {
    const who = "path-string?"
    check_string(who, o)
    const s = string_string(o)
    if (s === "")
        return o_false
    if (/[\0]/.test(s))
        return o_false
    return o_true
}

function path_is_absolute(p) {
    return path.isAbsolute(p)
}
function o_is_relative_path(o) {
    check_path_string("relative-path?", o)
    return make_boolean(!path_is_absolute(string_string(o)))
}
function getcwd() {
    return process.cwd()
}
function o_current_directory() {
    return make_string(getcwd())
}

function o_build_path_multi(who, paths, build_path2) {
    js_display("o_build_path_multi")
    js_display("who")
    js_write(who)
    js_display("paths")
    js_write(paths)
    
    // Checks that all paths (except perhaps the first)
    // are relative paths. Then folds the list using the
    // two argument version `build_path2`. 
    //     build_path2 : obj obj -> obj
    let pre = car(paths)
    check_path_string(who, pre)

    paths = cdr(paths)

    while (1) {
        if (paths === o_null)
            return pre

        let post  = car(paths)
        paths = cdr(paths)

        check_path_string(who, post)

        if (path_is_absolute(string_string(post)))
            throw new Error(who + ": additional path is not relative\ngiven: " + string_string(post))

        pre = build_path2(pre, post)
    }
}
function o_build_raw_path(paths) {
    return o_build_path_multi("build-raw-path", paths, o_build_raw_path2)
}
function o_build_path(paths) {
    return o_build_path_multi("build-path", paths, o_build_path2)
}
function o_normalize_input_path(path) {
    /* Using "." is meant to work even if `path` is absolute: */
    return o_build_path2(make_string("."), path)
}
function o_build_raw_path2(pre, post) {
    // TODO: currently this is the same as o_build_path2
    // path.join normalizes and returns "." to signal current directory
    return make_string( path.join( string_string(pre), string_string(post) ) )
}
function o_build_path2(pre, post) {
    // path.join normalizes and returns "." to signal current directory
    return make_string( path.join( string_string(pre), string_string(post) ) )
}


function basename(p) {
    return path.basename(p)
}
function dirname(p) {
    let d = path.dirname(p)
    return (d === ".") ? false : d
}
function o_split_path(path) {
    const who = "split-path"
    check_path_string(who, path)
    let p = string_string(path)
    let d = dirname(p)
    let b = basename(p)
    return o_cons( d ? make_string(d): o_false,
                   make_string(b) )
}

function o_build_module_path(base_mod_path, rel_mod_path) {
    js_display("build-module-path")
    js_display("base")
    js_write(base_mod_path)
    js_display("rel")
    js_write(rel_mod_path)
    
    if (is_symbol(rel_mod_path))
        return rel_mod_path
    if (path_is_absolute(string_string(base_mod_path)))
        return rel_mod_path
    
    let rel_str = string_string(rel_mod_path)
    if (is_symbol(base_mod_path)) {
        // remove .rac if present at the end
        let groups = /^(.*)[.]rac$/.exec(rel_str)
        if (groups !== null)
            rel_str = groups[1]
        // maybe add /main to the base module path
        let saw_slash = /[/]/.test(symbol_string(base_mod_path))
        if (!saw_slash)
            base_mod_path = symbol_string(base_mod_path) + "/main"
        base_mod_path = (is_symbol(base_mod_path) ? symbol_string(base_mod_path) : base_mod_path)
        base_mod_path = car(o_split_path(make_string(base_mod_path)))
        js_display("base_mod_path after split")
        js_write(base_mod_path)
        return sym( string_string(o_build_path2( o_string_to_symbol(base_mod_path), sym(rel_str) ) ))
    } else {
        base_mod_path = car(o_split_path(base_mod_path))
        //js_display("o_build_module-path - split base-path")
        //js_write(base_mod_path)
        //js_display("--")
        if (base_mod_path === o_false)
            base_mod_path = make_string("./")
        return make_string(build_path(string_string(base_mod_path),
                                      rel_str))
  }
}



// private primitive
function register_module(modpath, mod) {
    // js_display("> register-module")
    // js_display("> register module: modpath is")
    // js_write(modpath)
    const who = "register_module"
    // Register the module `mod` which hasn't been registered before.
    if (!(tag(mod) === hash_tag)) 
        throw new Error(who+": module did not produce a hash table " + format(modpath))
    
    if ( (o_pending_modules == o_null) || (modpath != o_car(o_pending_modules)) )
        throw new Error("attempting to register unexpected module: " + format(modpath))

    o_modules = o_cons(o_cons(modpath, mod), o_modules)
    o_pending_modules = o_cdr(o_pending_modules)

    return mod
} 

// private primitive
function get_read_and_eval(lang, mod) {
    // js_display("> o_get_read_and_eval")
    // js_write(["lang", lang])
    // js_write(["mod",  mod])    
    let proc = o_hash_ref(mod, sym("read-and-eval"), o_false)
    // js_write(["proc",  proc])    
    if (!(tag(proc) === closure_tag))
        throw new Error("not a language module path: " + format(lang))
    return proc
}

function read_language(sp, who) {
    // js_display("> read_language")    
    // 1. skip whitespace and comments
    // 2. read "#lang " and `module-path`.
    // 3. return the module path as symbol or string.
    // 4. effect: the position of sp is now after the module path.
    if (who === undefined) who = "read-language"
    skip_atmosphere(sp)
    eat_string(sp, "#lang ", who, "expected #lang followed by a space")
    let mp = maybe_read_module_path(sp)
    if (o_is_module_path(mp))
        return mp
    throw new Error(who + ": expected module library path after #lang")
}


function o_kernel_read_string(args) {
    // receives one argument (a list)
    //js_display("> o_kernel_read_string")
    // This is `read-and-eval` for the `kernel` module.
    // Well, the read part of it.
    let who = "read-and-eval"

    if (js_list_length(args) != 3) {
        js_write(args)
        throw new Error( "read-and-eval: " + format(args))
    }

    let str      =             o_car(args)   // text for the whole module
    let start_i  =       o_car(o_cdr(args))  // index for start of module body
    let mod_path = o_car(o_cdr(o_cdr(args))) // the module path

    //js_display("str")
    //js_write(str)
    //js_display("start_i")
    //js_write(str)
    //js_display("str")
    //js_write(mod_path)
    
    check_string(who, str)
    check_integer(who, start_i)
    check_module_path(who, mod_path)

    let start = number_value(start_i)
    if ((start < 0) || (start > string_length(str)))
        throw new Error(who + ": starting index is out of bounds " + start_i)

    let es = o_string_read(str, start_i, mod_path)

    if (es === o_null)
        throw new Error("rac/kernel: no S-expression in input")
    if (!(o_cdr(es) === o_null))
        throw new Error("rac/kernel: more than one S-expression in input")

    return o_car(es)
}

function module_path_equal(mp1, mp2) {
    if (tag(mp1) === symbol_tag)
        return mp1 === mp2
    if (tag(mp2) === symbol_tag)
        return false
    return o_string_equal(mp1,mp2) === o_true
}

function check_module_path(who, mp) {
    //js_display("check_module_path")
    //js_display("mp")
    //js_write(mp)
    if (o_is_module_path(mp) === o_false)
        throw new Error(who + ": module path expected, got " + format(mp))
}

function build_path(base, rel) {
    let out = base + "/" + rel
    return out
}

function file_to_string(path) {
    js_display("file_to_string")
    js_display("path")
    js_write(path)
    
    path = (is_string(path) ? string_string(path) : path)
    
    let s = fs.readFileSync(path, "utf8")
    return s
}

let o_library_path = o_false  // o_false or absolute path

function library_path_to_file_path(path) {
    if ( !is_symbol(path) )
        throw new Error("module-path->path: expected a module path")
    if( o_library_path === o_false)
        throw new Error("no library path configured, cannot load module: " + format(path))

    let saw_slash = /[/]/.test(symbol_string(path))
    
    let rel = o_tilde_a(list(o_symbol_to_string(path),
                             saw_slash ? make_string("") : make_string("/main"),
                             make_string(".rac")))
    let rel_str = string_string(rel)
    return build_path(o_library_path, rel_str)
}

// This is the implementation of the private primitive `o_module_hash_star`.

function module_to_hash_star(mp) {
    //js_display(["module_to_hash_star", mp])

    // Does the work for module->hash in the case,
    // where the module is already declared.
    let who = "module->hash"
    check_module_path(who, mp)

    // loop over the list of declared modules,
    // which is a list of (cons mp hash)
    let ms = o_modules
    while (! (ms === o_null)) {
        let a = o_car(ms)
        if ( module_path_equal(o_car(a), mp) ) {
            // js_display("module_to_hash_star, found: ")
            // js_write(mp)
            // js_write(o_cdr(a))
            return o_cdr(a)
        }
        ms = o_cdr(ms)
    }

    // check for cycles
    let ps = o_pending_modules
    while (! (ps === o_null)) {
        if ( module_path_equal(o_car(ps), mp) )
            throw new Error("cycle in module loading, while loading: " + format(mp))
        ps = o_cdr(ps)
    }

    // mp is not declared, so we must prepare loading it
    o_pending_modules = o_cons(mp, o_pending_modules)

    let filepath = (is_symbol(mp) ? library_path_to_file_path(mp) : mp )

    // todo: log module start
    {
        // 1. read the file to a string
        // 2. read the language
        // 3. return language, string port and module path

        let s = file_to_string(filepath)
        let sp = make_string_input_port(s)
        let lang = read_language(sp, "module->hash")

        //js_display("out:")
        //js_write( lang )
        //js_write( string_input_port_string(sp) )
        //js_write( string_input_port_pos(sp) )
        //js_write( mp ) 
        return list(lang,
                    make_string(string_input_port_string(sp)),
                    make_number(string_input_port_pos(sp)),
                    mp)
    }    
}


function o_module_to_hash(mp) {
    // This function calls the value of `module->hash` in the
    // top-level environment. That value happens to be a closure
    // (see `make_top_env`) that actually does the work.
    // js_display(["o_module_to_hash", mp])    
    check_symbol("module->hash", mp)
    return kernel_eval( list(o_top_ref(o_top_env, sym("module->hash")),
                             list(quote_symbol, mp)))
}
    
// SINGLETONS

const o_apply               = [singleton_tag, "apply"]
const o_callcc              = [singleton_tag, "call/cc"]
const o_call_prompt         = [singleton_tag, "call/prompt"]
const o_kernel_eval         = [singleton_tag, "kernel-eval"]
const o_is_prompt_available = [singleton_tag, "is_prompt_available"]


// PROCEDURES

function o_is_procedure(o) {
    let t = tag(o)
    return ((   (t === primitive_tag)
            || (t === closure_tag)
            || (t === continuation_tag)
            || (o === o_apply)
            || (o === o_callcc)
            || (o === o_call_prompt)
            || (o === o_is_prompt_available)
            || (o === o_kernel_eval))
            ? o_true : o_false)
}



// CLOSURES
function is_closure(o) { return Array.isArray(o) && (tag(o) === closure_tag) }

function make_closure(e, env) {
    return [closure_tag, e, env]
}
function closure_e(o)   { return o[1] }
function closure_env(o) { return o[2] }
function set_closure_e(o,e) { o[1] = e }

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
function dispatch0(proc, args) { // eslint-disable-line 
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
function dispatch12(proc, args) {    
    return proc(o_car(args), (o_cdr(args) === o_null ? undefined : o_car(o_cdr(args))))
}
function dispatch123(proc, args) {
    if ( o_cdr(args) === o_null )
        return proc(o_car(args))
    if ( o_cdr(o_cdr(args)) === o_null )
        return proc(o_car(args), o_car(o_cdr(args)))
    else // if ( o_cdr(o_cdr(o_cdr(args))) === o_null )
        return proc(o_car(args), o_car(o_cdr(args)), o_car(o_cdr(o_cdr(args))))
}
function dispatch23(proc, args) {    
    return proc(o_car(args), o_car(o_cdr(args)),
                (o_cdr(o_cdr(args)) === o_null ? undefined : o_car(o_cdr(o_cdr(args)))))
}
function dispatchn(proc, args) {
    return proc(args)
}

// OUTPUT

function fprintf(file_handle, format_string, ...arg) {
    file_handle.write( util.format(format_string, ...arg) )
}


// ERRORS

function fail(msg) {
    throw new Error(msg)
}
function show_err1w(who, str, obj) {
    if (who !== null)
        fprintf(stderr, "%s: ", who)
    fprintf(stderr, "%s: ", str)
    o_fprint(stderr, obj)
}
function fail1w(who, str, obj) {
    // error_color();
    show_err1w(who, str, obj)
    fail("")
}
function fail_arg(who, what, obj) {
    let not_a = false
    if ((what[0] === 'a') || (what[0] === 'e') || (what[0] === 'i')
        || (what[0] === 'o') || (what[0] === 'u'))
        not_a = "not an "
    else
        not_a = "not a "
    let msg = format( list(make_string(not_a), make_string(what)),
                      display_mode)
    fail1w(who, string_string(msg), obj)
}
function check_string(name, o) {
    if (!is_string(o))
        fail_expected1(name, "string", o)
}
function check_symbol(name, o) {
    if (!is_symbol(o))
        fail_expected1(name, "symbol", o)
}
function check_hash(name, o) {
    if (!is_hash(o))
        fail_expected1(name, "hash", o)
}
function check_number(name, o) {
    if (!is_number(o))
        fail_expected1(name, "number", o)
}
function check_numbers(name, o1, o2) {
    if (!is_number(o1))
        fail_expected1(name, "number", o1)
    if (!is_number(o2))
        fail_expected1(name, "number", o2)
}
function check_path_string(who,o) {
    if (o_is_path_string(o) === o_false)
        fail_expected1(who, "path string", o)
}

function fail_expected1(name, type, value) {
    console.log(name + ":")
    console.log("  expected: " + type)
    js_display("given:")
    js_write(value)
    // console.log("  given: " + format(value))
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
    // js_write(args)
    throw new Error("^^^^")
}
function error_arg(name, argument_name, arg) {
    console.log(name + ": ")
    console.log("   expected:" + argument_name)
    console.log("   given:"    + arg)
    throw new Error("^^^^")
}


// TERMINAL SUPPORT

/*

function print_terminal(which, str) {
  if (is_terminal(get_std_handle(which))) {
    fprintf((which === 1) ? stdout : stderr, "%s", str)
  }
}

static void zuo_error_color() {
  zuo_suspend_signal();
  zuo_print_terminal(2, "\033[91m");
}

static void zuo_alert_color() {
  zuo_suspend_signal();
  zuo_print_terminal(1, "\033[94m");
}

static void zuo_normal_color(int which) {
  zuo_print_terminal(which, "\033[0m");
  fflush((which == 1) ? stdout : stderr);
  zuo_resume_signal();
}

*/

// ERROR PRIMITIVES

function fout(file_out, obj, mode) {
    js_display(format(obj, mode))
}

/*
function fout(file_out, obj, mode) {
  out_init(file_out)
  out(file_out, obj, mode)
  fwrite(out.s, 1, out.len, fout)
  out_done(file_out)
}
*/

function fprint(  file_out, obj) { fout(file_out, obj, print_mode)   }
function fdisplay(file_out, obj) { fout(file_out, obj, display_mode) }
function fwrite(  file_out, obj) { fout(file_out, obj, write_mode)   }

function falert(f, objs) {
    if ( is_pair(objs) && is_string(car(objs)) ) {
    fdisplay(f, car(objs))
    objs = cdr(objs)
    if (objs !== o_null) fprintf(f, ": ")
  }
  fdisplay(f, o_tilde_v(objs))
}
function o_error(objs) {
    // error_color()
    falert(stderr, objs)
    fail("")
    return o_undefined
}
function o_alert(objs) {
    // alert_color()
    falert(stdout, objs)
    fprintf(stdout, "\n")
    // normal_color(1)
    return o_void
}
function o_arg_error(name, what, arg) {
    const who = "arg-error"
    check_symbol(who, name)
    check_string(who, what)
    fail_arg(symbol_string(name), string_string(what), arg)
    return o_undefined
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
function eat_string(sp, expect, who, msg) {
    let s = string_input_port_string(sp)
    let i = string_input_port_pos(sp)
    let n = expect.length
    let p = s.substring(i,n)
    if (p == expect)
        set_string_input_port_pos(sp,i+n)
    else
        throw new Error(who + ": " + msg)
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
const LPAREN          = Symbol.for("(")
const RPAREN          = Symbol.for(")")
const LBRACKET        = Symbol.for("[")
const RBRACKET        = Symbol.for("]")
const DOT             = Symbol.for(".")
const QUOTE           = Symbol.for("'")
const QUASIQUOTE      = Symbol.for("`")
const UNQUOTE         = Symbol.for(",")
const UNQUOTESPLICING = Symbol.for(",@")
const HASHSEMICOLON   = Symbol.for("#;")

function lex(sp) {
    skip_atmosphere(sp)
    let c = peek_char(sp)
    // console.log("lex")
    // console.log(c)
    if      (c === EOF)   { return EOF }
    else if (is_digit(c)) { return lex_number(sp) }
    else if (c == "(")    { read_char(sp) ; return LPAREN }
    else if (c == ")")    { read_char(sp) ; return RPAREN }
    else if (c == "[")    { read_char(sp) ; return LBRACKET }
    else if (c == "]")    { read_char(sp) ; return RBRACKET }
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
        if ( (p === "t") || (p === "f") ) {
            return lex_boolean(sp)
        } else if ( p === ";" ) {
            read_char(sp)
            return HASHSEMICOLON
        } else {
            back_char(sp)
            return lex_symbol(sp)           
        }
    } else if (c == "`") {
        read_char(sp)
        return QUASIQUOTE
    } else if (c == ",") {
        read_char(sp)
        if (peek_char(sp) == "@") {
            read_char(sp)
            return UNQUOTESPLICING
        } else
            return UNQUOTE
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
        js_write(c)
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
    read_char(sp) // the "
    let cs = []
    let i  = 0
    while (true) { // eslint-disable-line
        let c = read_char(sp)
        if (c === "\\") {
            let p = peek_char(sp)
            if      (p === "t")  { read_char(sp); cs[i++] = "\t" }
            else if (p === "n" ) { read_char(sp); cs[i++] = "\n" }
            else if (p === "\\") { read_char(sp); cs[i++] = "\\" }
            else if (p === EOF)  { throw new Error(
                "read: end-of-file object occurred while reading a string") }
            else                 { read_char(sp); cs[i++] = p    }
        } else if (c === "\"") {
            return make_string(cs.join(""))
        } else {
            cs[i++] = c
        }
    }
}

function maybe_read_module_path(sp) {
    skip_atmosphere(sp)
    let p = peek_char(sp)
    if (p === "\"")
        return lex_string(sp)
    if (p === EOF)
        return false
    if (/[a-zA-Z0-9/+-]/.test(p))
        return lex_symbol(sp)
    return false
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
//  <s>          ::= <literal>
//                |  (<s> ...) 
//                |  (<s> ... . <s>) 
//                |  '<s>
// Note: [ ] can be used instead of ( ).

// https://docs.racket-lang.org/zuo/reader.html

function is_literal(token) {
    let t = token
    return (is_boolean(t)
            || is_number(t)
            || is_string(t)
            || is_symbol(t))    
}
            

function parse_s_expr(tokens, i) {
    // parse a single s-expression from the
    // tokens tokens[i], tokens[i+1], ....
    // Return an array with two elements:
    //   - the parsed s-expressions
    //   - the index just after the last token used

    let n = tokens.length
    const EOT = Symbol("End of tokens")
    function peek ()    { return (i<n ? tokens[i] : EOT ) }
    function skip ()    { if (i<n) i++ }
    function read ()    { return (i<n ? tokens[i++] : EOT ) }
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
    function head()             { return stack[stack_i-1] }
    
    let t = false
    let obj = o_undefined 
    while (true) {  // eslint-disable-line
        if ( (obj !== o_undefined) && is_stack_empty())
            return [obj, i]

        if (obj === o_undefined) {
            t = read()
            if (is_literal(t)) 
                obj = t
            if (t === EOT) {
                if (!is_stack_empty())
                    throw new Error( "unexpected end of file" )
                return [o_eof, i]
            }
        }
        // All tokens (non-literals):
        //   LPAREN, RPAREN, LBRACKET, RBRACKET, DOT
        //   QUOTE, QUASIQUOTE, UNQUOTE, UNQUOTESPLICING

        if ((t === LPAREN) || (t === LBRACKET)) {
            obj = o_undefined
            let c = (t === LPAREN) ? "in paren list" : "in bracket list"
            pushdata(c, [c, o_null, o_null] ) //  data = [command,  first pair, last pair]
        }
        else if (t === QUOTE) {
            obj = o_undefined
            pushdata("in quote", sym("quote"))
        }
        else if (t === QUASIQUOTE) {
            obj = o_undefined
            pushdata("in quote", sym("quasiquote"))
        }
        else if (t === UNQUOTE) {
            obj = o_undefined
            pushdata("in quote", sym("unquote"))
        }
        else if (t === UNQUOTESPLICING) {
            obj= o_undefined
            pushdata("in quote", sym("unquote-splicing"))
        }
        else if (t === HASHSEMICOLON) {
            obj = o_undefined
            pushdata("in discard", o_null)
        }
        else if (t === DOT) {
            if (!is_stack_empty() && (head()[0] == "in paren list") ) {
                head()[0]    = "in paren pair"
                head()[1][0] = "in paren pair"
            }
            else if (!is_stack_empty() && (head()[0] == "in bracket list") ) {
                head()[0]    = "in bracket pair"
                head()[1][0] = "in bracket pair"
            }
            else
                throw new Error("misplaced '.'")
            obj = o_undefined
        }
        else if ( (t === RPAREN) || (t === RBRACKET)) {
            let want_list = ((t === RPAREN) ? "in paren list" : "in bracket list")
            let want_pair = ((t === RPAREN) ? "in paren pair" : "in bracket pair")
            //  data = [command,  first pair, last pair]
            if (!is_stack_empty() && ((head()[0] == want_list)
                                      || ((head()[0] == want_pair)))) {
                let inst = pop()
                let data = inst[1]
                obj = data[1]
            } else if ((!is_stack_empty()) && (head()[0] === "in paren end")) {
                if (t === RPAREN) {
                    let inst = pop()
                    let data = inst[1]
                    js_display("data")
                    js_write(data)
                    obj = data
                } else
                    throw new Error("expected end paren, but got end bracket")
            } else if ((!is_stack_empty()) && (head()[0] === "in bracket end")) {
                if (t === RBRACKET) {
                    let inst = pop()
                    let data = inst[1]
                    obj = data
                } else
                    throw new Error("expected end bracket, but got end paren")
            } else {
                obj = o_undefined
            }
        }
        else if (is_stack_empty()) {
            if ( obj !== o_undefined ) {
                return [obj, i]
            }
            if (t === EOT)
                return [o_eof, i]
            if (t === RPAREN) 
                throw new Error( "Unexpected right paren" )
            if (t === RBRACKET) 
                throw new Error( "Unexpected right bracket" )
            if (t === DOT) 
                throw new Error( "Unexpected dot" )
        }
        while(!is_stack_empty()) {
            if (obj === o_undefined) {
                // the commands needs an object to operate on
                break
            }
            let inst = pop()
            let cmd  = inst[0]
            let data = inst[1]

            if (cmd === "in quote") {
                if (obj === o_eof)
                    throw new Error("end of file")
                // data contains either 'quote 'quasiquote 'unquote or 'unquote-splicing
                obj = list(data, obj)
            } else if (cmd === "in discard") { // #; comment
                if (is_eof(obj))
                    throw new Error( "end of file after hash-semicolon comment" )
                obj = o_undefined
                break
            } else if ( (cmd === "in paren list") || (cmd === "in bracket list")) {
                if (obj === o_eof)
                    throw new Error("missing closer")
                else {
                    // `(` pushes "paren list" and
                    //  data = [command,  first pair, last pair]
                    let new_pair = o_cons(obj, o_null)  
                    if (data[1] === o_null)  // no pairs yet
                        pushdata(cmd, [cmd, new_pair, new_pair])
                    else {
                        set_cdr(data[2], new_pair)
                        pushdata(cmd, [cmd, data[1], new_pair])
                    }
                    obj = o_undefined // read next token
                    break
                }
            } else if ( (cmd === "in paren pair") || (cmd === "in bracket pair")) {
                //  data = [command,  first pair, last pair]
                if (obj === o_eof) 
                    throw new Error("end of file after dot")
                else {
                    set_cdr(data[2], obj) // put obj in the last pair
                    let new_cmd = ( (cmd === "in paren pair") ? "in paren end" : "in bracket end" )
                    pushdata(new_cmd, data[1])
                    obj = o_undefined // read next token
                    break
                }                
            }
        }
    }
}
            
function read_from_string(s) {
    let sp = make_string_input_port(s)
    let tokens = []
    let i = 0
    let t = lex(sp)
    while (!(t === EOF)) {
        tokens[i++] = t
        t = lex(sp)
    }
    return tokens
}

function parse1(str) {
    let tokens = read_from_string(str)
    return parse_s_expr(tokens, 0)[0]
}


function o_string_read(str, start, where) {
    let who = "string-read"
    if (start === undefined)
        start = make_number(0)
    if (where === undefined)
        where = o_false
    check_string(who, str)
    check_integer(who, start)
    let idx = check_string_index(who, str, start);
    
    let sp = make_string_input_port(string_string(str))
    set_string_input_port_pos(sp,idx)
    
    let tokens = []
    let i = number_value(start)
    let t = lex(sp)
    while (!(t === EOF)) {
        tokens[i++] = t
        t = lex(sp)
    }

    let first = o_null
    let last  = false
    i = 0
    let obj = o_false
    while (true) {
        let obj_and_index = parse_s_expr(tokens, i)
        obj = obj_and_index[0]
        i   = obj_and_index[1]
        if (obj === o_eof)
            break
        let p = o_cons(obj, o_null)
        if (first === o_null)
            first = p
        else
            set_cdr(last, p)
        last = p
    }    
    return first
}
    

// WRITING

// const pair_tag               = ["pair"]

// const string_input_port_tag  = ["string_input_port"]  // internal for now
// const string_output_port_tag = ["string_output_port"] // internal for now

const print_mode   = Symbol("print-mode")
const write_mode   = Symbol("write-mode")
const display_mode = Symbol("display-mode")

function to_string(os, mode) {
    let as = list_to_array(os)
    let fs = as.map( (o) => format(o, mode) )
    return fs.join(mode === display_mode ? "" : " ")
}

function o_tilde_v(os) { return make_string(to_string(os, print_mode))   } // TODO WIP use mode in o_to_string 
function o_tilde_s(os) { return make_string(to_string(os, write_mode))   } // TODO WIP
function o_tilde_a(os) { return make_string(to_string(os, display_mode)) } // TODO WIP

function format_symbol(o, mode)  { return (mode === print_mode ? "'" : "") + symbol_string(o) }
function format_number(o)        { return number_value(o).toString() }
function format_boolean(o)       { return (o === o_false ? "#f" : "#t") }
function format_string(o,mode) {
    let s = string_string(o) ;
    return (mode===display_mode)?s:"\""+s+"\""
}
function format_opaque(o) {
    return "<"
        + (  is_string(o) ? format_string(o, display_mode)
             : ( is_symbol(o) ? format_symbol(o, display_mode)
                 : "opaque"))
        + ">"
}

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
        // || (t == trie_tag)
        || (o === o_null)          
        || (o === o_void)           
        || (o === o_undefined)
        || (o === o_eof)
        || (o === o_apply)          
        || (o === o_callcc)         
        || (o === o_call_prompt)
        || (o === o_is_prompt_available)
        || (o === o_kernel_eval)
}


function format_atom (o, mode) {
    // atom here means a single value, which can be formatted
    // without recursion
    let t = tag(o)
    if      (t == symbol_tag)             { return format_symbol(o, mode) }
    else if (t == number_tag)             { return format_number(o)   }
    else if (t == boolean_tag)            { return format_boolean(o)  }
    else if (t == string_tag)             { return format_string(o, mode) }
    else if (t == closure_tag)            {
        let maybe_name = o_car(o_cdr(o_cdr(closure_e(o))))
        return  "#<procedure" + (is_string(maybe_name) ?
                                 ":" + string_string(maybe_name) :
                                 "")
            + ">"
    }
    else if (t == primitive_tag)          { return "#<procedure:" + primitive_name(o) +  ">" }
    else if (t == continuation_tag)       { return "#<continuation>" }
    else if (t == hash_tag)               { return  "#<hash>" }        
    else if (t == opaque_tag)             { return format_opaque(o) }
    // else if (t == trie_tag)           { return js_write(o) ; "#<trie>" }
    else if (o === o_null)                { return "()" }
    else if (o === o_void)                { return "#<void>" }
    else if (o === o_eof)                 { return "#<eof>" }
    else if (o === o_undefined)           { return "#<undefined>" }
    else if (o === o_apply)               { return "#<procedure:apply>" }
    else if (o === o_callcc)              { return "#<procedure:call/cc>" }
    else if (o === o_call_prompt)         { return "#<procedure:call/prompt>" }
    else if (o === o_is_prompt_available) { return "#<procedure:o_is_prompt_available>" }
    else if (o === o_kernel_eval)         { return "#<procedure:kernel-eval>" }
    else
        throw new Error("format_atom: expected atom, got: " + js_format(o))
}
    
function format(o, mode) {
    if (o === undefined)
        return "<js-undefined>"
    if (mode === undefined)
        mode = display_mode
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
                write_string(sp, format_atom(o, mode))
            } else if (is_pair(o)) {
                if (mode === print_mode)
                    write_string(sp, "'")
                write_string(sp, "(")
                pushdata("tail", o_cdr(o))
                o = o_car(o)
                push("datum")
            }            
        } else if (cmd === "tail") {
            o = data
            if (is_pair(o)) {
                write_string(sp, " ")
                pushdata("tail", o_cdr(o))
                o = o_car(o)
                push("datum")
            } else if (o === o_null) {
                write_string(sp, ")")
            } else if (is_atom(o)) {
                write_string(sp, " . ")                
                write_string(sp, format_atom(o, mode))
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

// Note: Should the top level environment use a hash instead?

// Note: In JavaScript registered symbols can't be used
//       as keys for a weak map.

let top_level = new Map()

function extend_top_level(sym, o) {
    top_level.set(sym, o)
}

function lookup_top_level(sym) {
    return top_level.get(sym)
}

function reset_top_level () {
    top_level = new WeakMap()
}


function o_top_ref(s) {
    // check_symbol("top-ref", s) TODO
    let v = lookup_top_level(symbol_key(s))
    if (v === undefined)
        return o_false
    return v        
}
    

// TOP ENVIRONMENT
function o_kernel_env() {
    return make_top_env(hash_mode)
}


// Continuations

const done_k   = Symbol("done_k")
const define_k = Symbol("define_k")
const if_k     = Symbol("if_k")
const begin_k  = Symbol("begin_k")
const let_k    = Symbol("let_k")
const apply_k  = Symbol("apply_k")

const o_done_k = [done_k, false, false, make_empty_env()] // sentinel
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
    // let env = state_env(s)
    let v   = undefined
    // js_write(["env", env])

    while (v === undefined ) {
        if (is_symbol(e)) {
            v = lookup(state_env(s), e)
            if (v === undefined) {
                v = lookup_top_level(e)
                if (v === undefined) {
                    js_display("---")
                    js_display("lookup")
                    //js_display("env")
                    //js_write(state_env(s))
                    // js_write(e)
                    throw new Error("undefined: " + symbol_string(e))
                }
            }
	} else if (is_pair(e)) {
            // js_write(format(e))
            let rator = o_car(e)
            if (rator === quote_symbol) {
                v = o_car(o_cdr(e))
            } else if (rator === define_symbol) {
                // (define id expr)
                let id = o_car(o_cdr(e))
                let e0 = o_car(o_cdr(o_cdr(e)))
                e = e0
                let new_k = [define_k, id, state_k(s), state_env(s)]
                set_state_k(s,new_k)
            } else if (rator === if_symbol) {
                let e0 = o_car(o_cdr(e))
                let e1 = o_car(o_cdr(o_cdr(e)))
                let e2 = o_car(o_cdr(o_cdr(o_cdr(e))))
                e = e0
                let new_k = [if_k, [e1, e2], state_k(s), state_env(s)]
                set_state_k(s,new_k)
            } else if (rator === lambda_symbol) {
                v = make_closure(e, state_env(s))
            } else if (rator === begin_symbol) {
                let e0 = o_car(o_cdr(e))
                let es = o_cdr(o_cdr(e))
                e = e0
                if (!is_null(es)) {
                    let k = state_k(s)
                    let new_k = [begin_k, es, k, state_env(s)]
                    set_state_k(s, new_k)
                }
            } else if (rator === let_symbol) {
                // (let ([x e0]) e1)
                let x  =       o_car(o_car(o_car(o_cdr(e))))
                let e0 = o_car(o_cdr(o_car(o_car(o_cdr(e)))))
                let e1 = o_car(o_cdr(o_cdr(e)))
                e = e0
                let new_k = [let_k, [x,e1], state_k(s), state_env(s)]
                set_state_k(s, new_k)
            } else {
                // (e0 e ...)
                let e0 = o_car(e)
                let new_k = [apply_k, [o_null, o_cdr(e)], state_k(s), state_env(s)]
                e = e0
                set_state_k(s, new_k)
            }
        } else {
            v = e
        }
    }
    s[0] = v
    return s
}

function continue_step(s) {
    let k = state_k(s)
    let t = cont_type(k)
    if (t === apply_k) {
        // js_display("apply_k")
        let d = cont_data(k) // [reverse_vals,exprs]
        let rev_vals = d[0]
        let es = d[1]
        rev_vals = o_cons(state_v(s), rev_vals)
        if (!is_null(es)) {
            let e     = o_car(es)    
            let env   = cont_env(k)  
            let new_k = [apply_k, [rev_vals,o_cdr(es)], cont_next(k), env]	    
            // set_state_k(new_k)
            return [e,env,state_mem(s),new_k,state_m(s)]
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
            //js_display("rator")
            //console.log(rator)
            //js_write(rator)
            // js_display("env")
            // js_write(state_env(k))
            while (true) { // eslint-disable-line -- (loop in case of apply)
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
                    // js_display("apply")
                    // (apply rator arguments), arguments is a list of objects.
                    if (!(js_list_length(args)==2))
                        error_arity("apply", args)
                    rator = o_car(args)
                    args  = o_car(o_cdr(args))
                    count = js_list_length(args)
                    if (!is_list(args))
                        error_arg("apply", "list", args)                        
                    // no break => we loop and handle the new rator and args
                } else if (rator === o_kernel_eval) {
                    //js_display("KERNEL EVAL")
                    //js_display("env before")
                    //js_display("args")
                    //js_display(format(args))
                    //js_write(args)
                    count = js_list_length(args)
                    if (count != 1)
                        fail_arity(o_kernel_eval, args)

                    let e = o_car(args)
                    // check_syntax(Z.o_interp_e)  // TODO
                    let new_meta_k = o_cons( o_cons(cont_next(state_k(s)), o_false),
                                             state_m(s))
                    // inject(e) === [expression, initial_env, false, o_done_k, o_null]
                    return [e, initial_env, false, o_done_k, new_meta_k]
                } else if (rator === o_callcc) {
                    // console.log("call/cc")
                    // console.log(cont_next(state_k(s)))
                    if (count !== 1)
                        error_arity("callcc", args)
                    rator = o_car(args)
                    args  = o_cons([continuation_tag, cont_next(state_k(s))], o_null)
                    // no break => loop to call the callcc argument with the continuation
                } else if (rator === o_call_prompt) {
                    //console.log("call/prompt")
                    // (call/prompt proc tag)
                    if (count !== 2)
                        error_arity("call-prompt", args)
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
                } else if (rator === o_is_prompt_available) {
                    //js_display("continuation-prompt-available?")
                    if (count !== 1)
                        error_arity("continuation-prompt-available?", args)
                    let ctag = car(args)
                    check_symbol("continuation-prompt-available?", ctag)
                    let mk = state_m(s)
                    let v
                    if ( mk === o_null)
                        v = o_false
                    else
                        v = ((ctag === cdr(car(mk))) ? o_true : o_false)
                    return [v,state_env(s),state_mem(s),cont_next(k),state_m(s)]
                } else if (rator_tag === primitive_tag) {
                    // console.log(primitive_name(rator))
                    let f          = rator
                    let dispatcher = primitive_dispatcher(f)
                    let proc       = primitive_proc(f)
                    let mask       = primitive_arity_mask(f)
                    if (!( mask & ( 1 << ((count >= MAX_PRIM_ARITY) ? MAX_PRIM_ARITY : count) ) ))
                        throw new Error(   primitive_name(f) + ": arity mismatch;\n"
                                           + "  the expected number of arguments doesn't "
                                           + "match the given number\n"
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
                    let body1    = o_cdr(o_cdr(ce))
                    let body_d   = o_cdr(body1)
                    let body     = o_car(o_cdr(o_cdr(ce)))
                    if (body_d === o_null)
                        "todo"; // o_interp_in_proc = o_false
                    else {
                        let a = o_car(body1)
                        if (is_string(a))
                            // `a` is the name of the closure
                            // skip the string
                            body = o_car(body_d) // o_interp_in_proc = a
                        else
                            "todo"; // o_interp_in_proc = o_false
                    }
                    while (is_pair(formals)) {
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
                    js_display("------")
                    js_display(format(rator))
                    throw new Error("application: not a procedure")
                }
            }
        }	
    } else if (t === if_k) {
        // js_display("if_k")
        let d     = cont_data(k)
        let e     = ( state_v(s) == o_false) ? d[1] : d[0]
        let new_k = cont_next(k)
        let env   = cont_env(k)
        return [e,env,state_mem(s),new_k,state_m(s)]
    } else if (t === begin_k) {
        // js_display("begin_k")
        let d     = cont_data(k)
        let e     = o_car(d)
        let next  = cont_next(k)
        let new_k = is_null(o_cdr(d)) ? next : [begin_k, o_cdr(d), next, state_env(s)]
        let env   = cont_env(k)
        return [e,env,state_mem(s),new_k,state_m(s)]
    } else if (t === let_k) {
        // js_display("let_k")
        let v    = state_v(s)
        let d    = cont_data(k) 
        let x    = d[0]
        let e1   = d[1]
        let env1 = extend_env(cont_env(k), x, v)
        return [e1, env1, state_mem(s), cont_next(k),state_m(s)]
    } else if (t === define_k) {
        // js_display("define_k")
        let v = state_v(s)
        let x = cont_data(k)
        extend_top_level(x,v)
        return [o_cons(quote_symbol, o_cons(o_void, o_null)),
                state_env(s),state_mem(s),cont_next(k),state_m(s)]
    } else if (t === done_k) {
        // js_display("done_k")
        return s
    } else {
        console.log("//////")
        console.log(k)
        throw new Error("continue_step: unhandled continuation type")
    }    
}

// Note: We can call kernel_eval from JavaScript to evaluate
/// an expression in the kernel module.
// But ... if a program calls kernel_eval, it must be done within
// the exisiting interpreter loop, so o_kernel_eval is special cased
// in `continue`.

function kernel_eval(expr) {
    //js_display("kernel-eval")
    //js_display(["kernel_eval", expr])
    let initial_state = inject(expr)
    let s = initial_state
    while (true) { // eslint-disable-line  -- interpreter loop
	step(s)
	if (state_k(s) === o_done_k) {
            if (state_m(s) === o_null) { 
                return state_v(s)
            } else {
                // console.log("kernel_eval: discarding tag form meta continuations")
                // js_display("kernel_eval")
                // js_display("state_m(s)")
                // js_write( state_m(s) )
                set_state_k(s,o_car(o_car(state_m(s))))
                set_state_m(s,o_cdr(state_m(s)))
            }
	}
	s = continue_step(s)
    }
}

function o_js_write(o) {
    js_write(o)
    return o_void
}




// Primitives
function primitive0(name, proc)       { return register_primitive(name, proc, dispatch0,   1<<0)}
function primitive1(name, proc)       { return register_primitive(name, proc, dispatch1,   1<<1)}
function primitive2(name, proc)       { return register_primitive(name, proc, dispatch2,   1<<2)}
function primitive3(name, proc)       { return register_primitive(name, proc, dispatch3,   1<<3)}
function primitive12(name, proc)      { return register_primitive(name, proc, dispatch12, (1<<1)|(1<<2))}
function primitive123(name, proc)     { return register_primitive(name, proc, dispatch123,(1<<1)|(1<<2)|(1<<3))}
function primitive23(name, proc)      { return register_primitive(name, proc, dispatch23, (1<<2)|(1<<3))}
function primitiven(name, proc, mask) { return register_primitive(name, proc, dispatchn,   mask)}
// mask  1+2 = 1 or 2 arguments
// mask  1   exactly 1 argument
// maske 0   no arguments
// mask -1 = any number
// mask -2 = 1 or more


// private primitives
let p_kernel_read_string  = primitive1("kernel-read-string", o_kernel_read_string)
let p_module_to_hash_star = primitive1("module->hash*",      module_to_hash_star)
let p_get_read_and_eval   = primitive2("get-read-and-eval",  get_read_and_eval)
let p_register_module     = primitive2("register-module",    register_module)


const hash_mode = Symbol("hash_mode")
const env_mode  = Symbol("env_mode")
const top_mode  = Symbol("env_mode")


function make_top_env(mode) {
    // set env
    let env = false
    if (mode === env_mode)
        env = make_empty_env()
    else if (mode === hash_mode)
        env = o_empty_hash        
    
    // extend env with elements
    let extend = false
    if (mode === env_mode)
        extend = (name,val) => env = extend_env(env, name, val)
    else if (mode === hash_mode)
        extend = (name,val) => o_hash_set(env, name, val)
    else
        extend = (name,val) => extend_top_level(symbol_key(name), val)

    // Same order as
    //   https://docs.racket-lang.org/zuo/zuo-kernel.html#%28part._kernel-primitives%29

    extend(sym("pair?"),       primitive1("pair?",       o_is_pair))
    extend(sym("null"),        o_null)
    extend(sym("null?"),       primitive1("null?",       o_is_null))
    extend(sym("list?"),       primitive1("list?",       o_is_list))
    extend(sym("cons"),        primitive2("cons",        o_cons))
    extend(sym("car"),         primitive1("car",         o_car))
    extend(sym("cdr"),         primitive1("cdr",         o_cdr))
    extend(sym("list"),        primitiven("list",        o_list,   -1))
    extend(sym("append"),      primitiven("append",      o_append, -1))
    extend(sym("reverse"),     primitive1("reverse",     o_reverse))
    extend(sym("length"),      primitive1("length",      o_length))
    extend(sym("list-ref"),    primitive2("list-ref",    o_list_ref))
    extend(sym("list-set"),    primitive3("list-set",    o_list_set))

    // integer?
    extend(sym("number?"),     primitive1("number?",     o_is_number))
    extend(sym("zero?"),       primitive1("zero?",       o_is_zero))
    extend(sym("+"),           primitive2("+",           o_plus))
    extend(sym("-"),           primitive2("-",           o_minus))
    extend(sym("*"),           primitive2("*",           o_mult))
    extend(sym("/"),           primitive2("/",           o_div))
    extend(sym("quotient"),    primitive2("quotient",    o_quotient))
    extend(sym("remainder"),   primitive2("remainder",   o_remainder))
    extend(sym("modulo"),      primitive2("modulo",      o_modulo))
    extend(sym("="),           primitive2("=",           o_eql))
    extend(sym("<"),           primitive2("<",           o_lt))
    extend(sym("<="),          primitive2("<=",          o_le))
    extend(sym(">"),           primitive2(">",           o_gt))
    extend(sym(">="),          primitive2(">=",          o_ge))
    extend(sym("bitwise-and"), primitive2("bitwise-and", o_bitwise_and))
    extend(sym("bitwise-ior"), primitive2("bitwise-ior", o_bitwise_ior))
    extend(sym("bitwise-xor"), primitive2("bitwise-xor", o_bitwise_xor))
    extend(sym("bitwise-not"), primitive1("bitwise-not", o_bitwise_not))

    extend(sym("string?"),        primitive1("string?",        o_is_string))
    extend(sym("string-length"),  primitive1("string-length",  o_string_length))
    extend(sym("string-ref"),     primitive2("string-ref",     o_string_ref))
    extend(sym("substring"),      primitive23("substring",     o_substring))
    extend(sym("string"),         primitiven("string",         o_string, -1))
    extend(sym("string=?"),       primitive2("string=?",       o_string_equal))
    extend(sym("string-ci=?"),    primitive2("string-ci=?",    o_string_ci_equal))
    extend(sym("string<?"),       primitive2("string<?",       o_string_lt))
    // string-sha256
    extend(sym("string-split"),   primitive12("string-split",  o_string_split))

    extend(sym("symbol?"),        primitive1("symbol?",        o_is_symbol))
    extend(sym("symbol->string"), primitive1("symbol->string", o_symbol_to_string))
    extend(sym("string->symbol"), primitive1("string->symbol", o_string_to_symbol))
    extend(sym("string->uninterned-symbol"),
                                  primitive1("string->uninterned-symbol",
                                                               o_string_to_uninterned_symbol))
    // immutable hashes
    extend(sym("hash?"),        primitive1("hash?",        o_is_hash))
    extend(sym("hash"),         primitiven("hash",         o_hash, -1))
    extend(sym("hash-ref"),     primitive23("hash-ref",    o_hash_ref))
    extend(sym("hash-set"),     primitive3("hash-set",     o_hash_set))
    extend(sym("hash-remove"),  primitive2("hash-remove",  o_hash_remove))
    extend(sym("hash-keys"),    primitive1("hash-keys",    o_hash_keys))
    extend(sym("hash-count"),   primitive1("hash-count",   o_hash_count))
    extend(sym("hash-keys-subset?"), primitive2("hash-keys-subset?",  o_is_hash_keys_subset))
    
    
    extend(sym("eq?"),          primitive2("eq?",          o_is_eq))
    extend(sym("not"),          primitive1("not",          o_not))
    extend(sym("void"),         primitiven("void",         o_void_f, -1))
    
    extend(sym("procedure?"),   primitive1("procedure?",   o_is_procedure))
    extend(sym("apply"),                                   o_apply)
    extend(sym("call/cc"),                                 o_callcc)
    extend(sym("call/prompt"),                             o_call_prompt)
    extend(sym("continuation-prompt-available?"),          o_is_prompt_available)
    
    extend(sym("opaque"),        primitive2("opaque",         o_opaque))
    extend(sym("opaque-ref"),    primitive3("opaque-ref",     o_opaque_ref))
    
    extend(sym("path-string?"),  primitive1("path-string?",   o_is_path_string))
    extend(sym("build-path"),    primitiven("build-path",     o_build_path, -1))
    extend(sym("build-raw-path"),primitiven("build-raw-path", o_build_raw_path, -1))
    
    extend(sym("split-path"),        primitive1("split-path",        o_split_path))
    extend(sym("relative-path?"),    primitive1("relative-path?",    o_is_relative_path))
    extend(sym("module-path?"),      primitive1("module-path?",      o_is_module_path))
    extend(sym("build-module-path"), primitive2("build-module-path", o_build_module_path)) // todo: test
    extend(sym("variable?"),     primitive1("variable?",     o_is_variable))
    extend(sym("variable"),      primitive1("variable",      o_make_variable))
    extend(sym("variable-ref"),  primitive1("variable-ref",  o_variable_ref))
    extend(sym("variable-set!"), primitive2("variable-set!", o_variable_set))
    
    // handle?, fd-open-input, fd-open-output, fd-open-close, fd-read, fd-write
    // eof, fd-terminal?, cleanable-file, cleanable-cancel
    // stat, ls, rm, mv, mkdir, rmdir, symlink, readlink, cp,
    // runtime-ev, current-time
    // process, process-read, process-wait, string->shell, shell->strings
    
    extend(sym("string-read"), primitive123("string-read", o_string_read))
    extend(sym("~v"),           primitiven("~v",           o_tilde_v, -1))
    extend(sym("~a"),           primitiven("~a",           o_tilde_a, -1))          
    extend(sym("~s"),           primitiven("~s",           o_tilde_s, -1))
    extend(sym("error"),        primitiven("error",        o_error, -1))
    extend(sym("alert"),        primitiven("alert",        o_alert, -1))
    // arity-error
    extend(sym("arg-error"),    primitive3("arg-error",    o_arg_error))
    
    extend(sym("top-ref"),      primitive1("top-ref",      o_top_ref))
    extend(sym("kernel-env"),   primitive0("kernel-env",   o_kernel_env))
    extend(sym("kernel-eval"),  o_kernel_eval) // special primitive
    // module->hash (see below)
    // dump-image-and-exit
    // exit
    // suspend-signal
    // resume-signal
    
    // Output
    extend(sym("js-write"),    primitive1("js-write", o_js_write))
    
    // Besides the primitives above, we also have `module->hash`
    // which is implemented as a closure.

    // We allocate the closure first, and then set the expression afterwars.
    // This makes the recursive reference possible.

    extend(sym("read-and-eval"),
//           (lambda arg "read-and-eval"
//             (kernel-eval (kernel-read-from-string arg)))           
           make_closure( list(lambda_symbol, sym("arg"), make_string("read-and-eval (kernel)"),
                              list(top("kernel-eval"),
                                   list(p_kernel_read_string, sym("arg"))))))

    // todo: implement o_kernel_read_string

    let module_to_hash_clos = make_closure(false,make_empty_env())
    extend(sym("module->hash"), module_to_hash_clos) 
/*
  (lambda (mod) "module->hash"
   (let ([arg (module->hash* mod)]) // returns list(lang, sp, mp) or a hash
    (if (hash? arg)
     arg
     (register-module
      mod
      (apply (get-read-and-eval (car arg) (module->hash (car arg)))
             (cdr arg)))))
*/
    function top(name) { return o_top_ref(sym(name)) }
    
  // NB: We embed the private primitive o_module_to_hash_star directly.

                   //list(begin_symbol,
                   // list(o_top_ref(sym("js-write")), make_string("HERE")),
                   //list(o_top_ref(sym("js-write")), list(o_top_ref(sym("hash?")), sym("arg0"))),
                   // list(o_top_ref(sym("js-write")), sym("arg")),

/*    set_closure_e(
        module_to_hash_clos,
        list( lambda_symbol, list(sym("mod")), make_string("module->hash"),
              list(let_symbol,
                       list( list(sym("arg0"), list(p_module_to_hash_star, sym("mod")))),
                       list(if_symbol, list(top("hash?"), sym("arg0")),
                            sym("arg0"),
                            list(let_symbol, list( list(sym("a"), list(top("car"), sym("arg0"))) ),
                                     list(let_symbol, list( list(sym("d"), list(top("cdr"), sym("arg0")))),
                                              list(p_register_module,
                                                   sym("mod"),
                                                   list(o_apply, list(p_get_read_and_eval, sym("a"),
                                                                      list(module_to_hash_clos, sym("a"))),
                                                        sym("d")))))))),
*/  set_closure_e(
        module_to_hash_clos,
        list( lambda_symbol, list(sym("mod")), make_string("module->hash"),
              list(let_symbol,
                   list( list(sym("arg0"), list(p_module_to_hash_star, sym("mod")))),
                   list(if_symbol, list(top("hash?"), sym("arg0")),
                        sym("arg0"),
                        list(p_register_module,
                             sym("mod"),
                             list(o_apply,
                                  list(p_get_read_and_eval,
                                       list(top("car"), sym("arg0")),
                                       list(module_to_hash_clos, list(top("car"), sym("arg0")))),
                                  list(top("cdr"), sym("arg0"))))))),
        make_empty_env())  // an empty environment requires us to use `top` above
    return env
}

let o_top_env   = make_top_env(top_mode)  // inserts directly into top_level
let initial_env = make_top_env(env_mode)

// Declare the kernel module

let kernel_module_hash = make_empty_trie() 
o_hash_set(kernel_module_hash, sym("read-and-eval"), o_top_ref(sym("read-and-eval")))
o_pending_modules = o_cons(sym("rac/kernel"), o_pending_modules)
register_module(sym("rac/kernel"), kernel_module_hash)

o_library_path = "lib"


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
    let h = make_empty_trie()
    let foo = sym("foo")
    let bar = sym("bar")
    h = o_hash_set(h, foo, 42)
    let t1 = o_hash_ref(h, foo) === 42
    h = o_hash_set(h, foo, 43)
    let t2 = o_hash_ref(h, foo) === 43
    h = o_hash_set(h, bar, 44)
    let t3 = o_hash_ref(h, foo) === 43 
    let t4 = o_hash_ref(h, bar) === 44

    let h2 = o_hash(o_cons(foo, o_cons(42, o_cons(bar, o_cons(43, o_null)))))
    let t5 = o_hash_ref(h2, foo) === 42
    let t6 = o_hash_ref(h2, bar) === 43
    // console.log([t1,t2,t3,t4,t5,t6])
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
//console.log("...skipping")


/*

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
// let expr8  = parse( ["let", "x", 42, "x"] ) // => 42
// let expr9  = parse( ["let", "x", 42, "y"] ) // => error
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

// console.log( read_from_string( " ( foo bar 43 baz + +3 -10 -a - 10. 11.1 12.34 .34 .bar ..4 ... #t #f oo ' ` , ,@ )"))

//let expr42 = parse1("(let1 h (hash 'foo 42 'bar 43) 44)")
//js_write(expr42)
//js_display(format(expr42))
//js_display(format(o_kernel_eval(expr42)))


//let expr43 = parse1("(a 'b)")
// js_write(expr43)
//js_display(format(expr43))

/*


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

let expr57 = parse1("(length (list 11 22 33))")
let expr58 = parse1("(length (list))")

let expr59 = parse1("(list-ref (list 0 1 2 3 4 5 6 7) 0)")
let expr60 = parse1("(list-ref (list 0 1 2 3 4 5 6 7) 7)")
let expr61 = parse1("(list-ref (cons 0 (cons 1 2)) 1)")

let expr62 = parse1("(list-set (list 0 1 2 3 4 5 6 7) 2 22)")

let expr63 = parse1("(number? 42)")
let expr64 = parse1("(number? #t)")

let expr65 = parse1("(/ 12 4)")
let expr66 = parse1("(quotient 13 4)")
let expr67 = parse1("(remainder 13 4)")
let expr68 = parse1("(modulo 13 4)")

let expr69 = parse1("(= 1 1)")
let expr70 = parse1("(= 1 2)")
let expr71 = parse1("(< 1 2)")
let expr72 = parse1("(< 2 1)")
let expr73 = parse1("(<= 1 2)")
let expr74 = parse1("(<= 2 1)")
let expr75 = parse1("(> 2 1)")
let expr76 = parse1("(> 1 2)")
let expr77 = parse1("(>= 2 1)")
let expr78 = parse1("(>= 1 2)")

let expr79 = parse1("(bitwise-and 1 3)")
let expr80 = parse1("(bitwise-ior 1 3)")
let expr81 = parse1("(bitwise-xor 1 3)")
let expr82 = parse1("(bitwise-not 1)")

let expr83 = parse1("(string? \"foo\")")
let expr84 = parse1("(string-length \"foo\")")
let expr85 = parse1("(string->symbol \"foo\")")
let expr86 = parse1("(string->uninterned-symbol \"foo\")")

let expr87 = parse1("(string-ref \"foo\" 0)")
let expr88 = parse1("(string-ref \"foo\" 1)")

let expr89 = parse1("(substring \"foobar\" 3 5)")
let expr90 = parse1("(substring \"foobar\" 3)")

let expr91 = parse1("(string (string-ref \"foobar\" 0) (string-ref \"foobar\" 1) (string-ref \"foobar\" 2))")

let expr92 = parse1("(string=? \"foo\" \"foo\")")
let expr93 = parse1("(string=? \"foo\" \"fo\")")
let expr94 = parse1("(string-ci=? \"foo\" \"FoO\")")
let expr95 = parse1("(string-ci=? \"foo\" \"fo\")")
let expr96 = parse1("(string<? \"aaa\" \"aab\")")
let expr97 = parse1("(string<? \"aab\" \"aaa\")")

let expr98 = parse1("(string-split \"hello world is popular\")")
let expr99 = parse1("(string-split \"hello world is popular\" \"l\")")

let expr100 = parse1("(string->symbol \"foo\")")
let expr101 = parse1("(symbol->string (string->symbol \"foo\"))")
let expr102 = parse1("(eq? (string->symbol \"foo\") (string->symbol \"foo\"))")
let expr103 = parse1("(eq? 11 11)")
let expr104 = parse1("(= 11 11)")
let expr105 = parse1("(not #t)")
let expr106 = parse1("(not #f)")
let expr107 = parse1("(not 1)")

let expr108 = parse1("(void 1 2 3)")
let expr109 = parse1("(procedure? apply)")
let expr110 = parse1("(procedure? (lambda () 3))")
let expr111 = parse1("(procedure? +)")

let expr113 = parse1("(module-path? (string->symbol \"foo\"))")
let expr114 = parse1("(module-path? (string->symbol \"foo/bar\"))")
let expr115 = parse1("(module-path? (string->symbol \"foo//bar\"))")
let expr116 = parse1("(module-path? \"foo/bar\")")
let expr117 = parse1("(module-path? \"\")")

let expr118 = parse1("(string-read \"1 x foo (11 22) #t \")")
let expr119 = parse1("(string-read \"1\")")

*/



// js_display(format(o_kernel_eval(expr118)))


//js_display(format(o_kernel_eval(expr74)))
//js_display(format(o_kernel_eval(expr75)))
//js_display(format(o_kernel_eval(expr76)))
//js_display(format(o_kernel_eval(expr77)))
//js_display(format(o_kernel_eval(expr78)))

//o_pending_modules = o_cons(sym("kernel"), o_pending_modules)
// js_write(register_module( sym("kernel"), o_hash( array_to_list([sym("foo"), 42]) ) ))


//let sp = make_string_input_port("#lang foo")
//js_write(read_language(sp))
//js_write(sp)



// js_write(o_tilde_v(list(make_string("a"), sym("foo"))))
// js_write(o_tilde_s(list(make_string("a"), sym("foo"))))
// js_write(o_tilde_a(list(make_string("a"), sym("foo"))))

// js_write(library_path_to_file_path(sym("rac")))

// js_write( file_to_string(library_path_to_file_path(sym("rac"))))


//js_write( module_to_hash_star(sym("rac")) )

//js_write( o_top_ref(sym("+")))


// js_write(initial_env)
// js_write(make_top_env(env_mode, hash_mode))

// js_display(format(kernel_eval(parse1("(hash-ref (kernel-env) (quote +))"))))


// js_display( format(kernel_eval(parse1("module->hash")), write_mode))

// js_display( format(parse1("(let ((x 1)) (+ x 42))"), write_mode))

// js_display( format(kernel_eval(parse1("(let ((x 1)) (+ x 42))")), write_mode))

// js_display(format(kernel_eval(parse1("(hash? (hash))"))))

// js_display(format(kernel_eval(parse1("(apply (lambda (x) (+ x 3)) (list 1))"))))
// js_display(format(kernel_eval(parse1("(apply (lambda (x y) (+ x y)) (list 42 1))"))))


// js_write(o_kernel_eval(parse1("((lambda x (cons 11 x)) 22 33 44)")))

// js_display(format(kernel_eval(parse1("(module->hash (quote rac/kernel))"))))

// js_display(format(kernel_eval(parse1(
//     "((lambda arg \"foo\" (apply list (cdr arg))) 1 2 3)"))))





// js_display(format(o_kernel_eval(parse1("(js-write 42)"))))



/*
js_write(
o_kernel_read_string(
    list(make_string('#lang rac/datums\n"Hello world"\n'),
         make_number(16),
         make_string("foo"))))
*/

/*
js_display(format(kernel_eval(parse1('(begin \
                                          (define fact (lambda (n) \
                                             (if (= n 0) \
                                                  1 \
                                                 (* n (fact (- n 1)))))) \
                                           (fact 5))'))))
*/

// js_display(format(kernel_eval(parse1('(let ((as (list 1 2))) \
//                                          (list (apply (lambda xs (car xs)) as)\
//                                                 (cdr as)))'))))



//  js_display(format(kernel_eval(parse1('(let ((a (list 1 2))) ((lambda (a) a) a))'))))



// js_display(format(kernel_eval(parse1('(if (number? 1) 2 3)'))))

// js_display(format(kernel_eval(parse1('(kernel-eval 42)'))))

// js_display(format(kernel_eval(parse1('(~v 42 43)'))))

// js_write(read_from_string("(41 '42)"))

js_display("--------------")
// js_write(format(parse_tokens(read_from_string("(41 '42 43)"))))

// js_write(read_from_string("'41 42"))

// js_write(format(parse_tokens(read_from_string("(41 '42 43)"))))
// js_write(format(parse_tokens(read_from_string("'41)"))))

// let ts = read_from_string("('41 `42 '43 `44  \n\
//                              ; line comment  \n\
//                            ,45 ,@46 #;47 foo)")
// js_write(ts)

//let ts = read_from_string("(41 42 \"43\" 44)")
// let ts = read_from_string("( 42 )")
// js_write(format(parse_s_expr(ts, 0)), write_mode)
//js_write(ts)

// js_write(parse_s_expr(ts, 0))
//js_write(parse_s_expr(ts, 1))
//js_write(parse_s_expr(ts, 2))


// js_write(format(o_string_read(make_string("42 (43 44) 45"))))
// js_write(format(parse1("42 (43 44) 45")))

//js_display(format(kernel_eval(parse1(
//    '(apply ~v (hash-ref (module->hash (quote "lib/rac/hello.rac")) (quote datums)))'))))

//js_display(format(kernel_eval(parse1(
//    "(let ([x (variable 'y)]) (begin (variable-set! x 42) (variable-ref x)))"
//))))

/*
let t = make_empty_trie()
js_display("empty trie")
js_write(t)
let foo = sym("foo")
let bar = sym("bar")
// js_write(o_trie_lookup(t, sym("foo")))
js_display("inserting foo=42")
t = o_trie_extend(t, foo, 42)
js_write(t)

t = o_trie_extend(t, bar, 43)
t = o_trie_extend(t, foo, 44)

js_display("lookup foo and bar")
js_write(o_trie_lookup(t, foo))
js_write(o_trie_lookup(t, bar))
*/

//let h = o_hash(list(sym("foo"), 42, sym("bar"), 43))
//js_write(o_hash_ref(h, sym("bar")))



// js_display(format(kernel_eval(parse1(
//    '(hash-ref (module->hash (quote "lib/rac/hello.rac")) (quote datums))'
//))))


//js_display(format(kernel_eval(parse1(
//    '(relative-path? "lib/rac/private/base/and-or.rac"))'))))

//js_write(o_is_module_path(sym("rac/private/basebase-common/lib.rac")))

// js_write(o_split_path(make_string("foo/base/")))

//js_write(o_build_module_path(sym("foo/base/"),
//                             make_string("huh.rac")))

// js_write( symbol_list_sort( list( sym("foo"), sym("bar"), sym("baz")) ) )


// js_display(format(kernel_eval(parse1(
//    '(module->hash "lib/rac/private/base/and-or.rac")'))))


//js_display(format(kernel_eval(parse1(
//    '(module->hash "lib/rac/private/base-common/bind.rac")'))))

//js_display(format(kernel_eval(parse1(
//    '(module->hash "lib/rac/private/base-common/bind.rac")'))))

//js_display(format(kernel_eval(parse1(
//    '(hash-keys (module->hash "lib/rac/private/base-common/bind.rac"))'))))


//js_display(format(kernel_eval(parse1(
//    '(hash-ref (module->hash "basic-tests/hash.rac") \'results)'))))

function t(str) {
    // js_display("--")
    js_display(str)
    let result = kernel_eval(parse1(str))
    js_display(format(result))
    // js_write(result)
}

// OPAQUE

/*
t("(list (not (pair? (opaque 'hello \"hi\"))))")
t("(list (opaque-ref 'hello (opaque 'hello \"hi\") #f) \"hi\")")
t("(list (opaque-ref 'not-hello (opaque 'hello \"hi\") #f) #f))")
t("(list (opaque-ref (string->uninterned-symbol \"hello\") (opaque 'hello \"hi\") #f) #f)")
t("(list (opaque-ref 'hello (opaque (string->uninterned-symbol \"hello\") \"hi\") #f) #f)")
t("(list (opaque-ref (opaque 'hello \"hi\") 'hello #f) #f)")
t("(list (opaque-ref 10 10 #f) #f)")
t("(list (opaque-ref 10 10 'no) 'no)")
*/

// PROCEDURE

/*
t("(list (procedure? procedure?))")
t("(list (procedure? (lambda (x) x)))")
t("(list (procedure? (lambda args args)))")
t("(list (procedure? apply))")
t("(list (procedure? call/cc))")
t("(list (procedure? (call/cc (lambda (k) k))))")
t("(list (not (procedure? 1)))")

//t("(list (apply + '()) 0)")
//t("(list (apply + '(1)) 1)")
t("(list (apply + '(1 2)) 3)")
//t("(list (apply + '(1 2 3 4)) 10)")
t("(list (apply apply (list + '(1 2))) 3)")
//t("(list-fail (apply +) arity)")
//t("(list-fail (apply '(+ 1 2)) arity)")
//t("(list-fail (apply apply (cons + '(1 2))) arity)")
//t("(list-arg-fail (apply + 1) \"not a list\")")



t("(list (call/cc (lambda (k) (+ 1 (k 'ok)))) 'ok)")
t("(list (let ([f (call/cc (lambda (k) k))])\
         (if (procedure? f)\
             (f 10)\
             f))\
       10)")
//t("(list-fail (call/cc 1) \"not a procedure\")")

t("(list (call/prompt (lambda () 10) 'tag) 10)")
t("(list (let ([k (call/prompt\
                 (lambda ()\
                   (call/cc (lambda (k) k)))\
                 'tag)])\
         (+ 1 (call/prompt (lambda () (k 11)) 'tag)))\
       12)")


t("(list (let ([k (call/prompt\
                 (lambda ()\
                   (call/cc\
                    (lambda (esc)\
                      (+ 1\
                         (* 2\
                            (call/cc\
                             (lambda (k) (esc k))))))))\
                 'tag)])\
         (list (call/prompt (lambda () (k 3)) 'tag)\
               (call/prompt (lambda () (k 4)) 'tag)))\
       (list 7 9))")
//t("(list-fail (call/prompt 1 'tag) \"not a procedure\")")
//t("(list-fail (call/prompt void 7) \"not a symbol\")")

t("(list (continuation-prompt-available? 'tagx) #f)")

t("(list (call/prompt (lambda () (continuation-prompt-available? 'tag))\
                      'tag)\
       #t)")


t("(list (call/prompt (lambda ()\
                      (continuation-prompt-available? 'other))\
                    'tag)\
       #f)")
t("(list (call/prompt (lambda ()\
                      (call/prompt\
                       (lambda ()\
                         (continuation-prompt-available? 'tag))\
                       'other))\
                    'tag)\
        #f)")


t("(list (call/prompt (lambda ()\
                      (call/prompt\
                       (lambda ()\
                         (continuation-prompt-available? 'other))\
                       'other))\
                    'tag)\
       #t)")
t("(list (call/prompt (lambda ()\
                      (list (call/prompt\
                             (lambda ()\
                               (continuation-prompt-available? 'other))\
                             'other)\
                            (continuation-prompt-available? 'tag)))\
                    'tag)\
       '(#t #t))")
//t("(list-fail (call/prompt apply 'tag)
//            \"apply: wrong number of arguments: [no arguments]\n\")")
*/

// KERNEL

/*
t("(list (kernel-eval 1) 1)")
t("(list (kernel-eval 'cons) cons)")
t("(list (kernel-eval '(cons 1 2)) '(1 . 2))")
t("(list (procedure? (kernel-eval '(lambda (x) x))) #t)")
t("(list (procedure? (kernel-eval '(lambda (x x) x))) #t)")
t("(list (procedure? (kernel-eval '(lambda (x . x) x))) #t)")
t("(list (procedure? (kernel-eval '(lambda (x x) \"name\" x))) #t)")
t("(list ((kernel-eval '(lambda (x x) x)) #f 2) 2)")
t("(list ((kernel-eval '(lambda (x x . x) x)) #f 2 3 4) '(3 4))")
t("(list (((kernel-eval '(lambda (lambda) (lambda x x))) 1) 2) '(2))")
t("(list (kernel-eval '(quote cons)) 'cons)")
t("(list (kernel-eval '(if #t 1 2)) 1)")
t("(list (kernel-eval '(if 0 1 2)) 1)")
t("(list (kernel-eval '(if #f 1 2)) 2)")
t("(list (kernel-eval '(let ([x 1]) x)) 1)")
t("(list (kernel-eval '(let ([x 1]) (let ([x 2]) x))) 2)")
t("(list (kernel-eval '(let ([x 1]) (list (let ([x 2]) x) x))) '(2 1))")
t("(list (kernel-eval '(begin 1)) 1)")
t("(list (kernel-eval '(begin 1 2)) 2)")
t("(list (kernel-eval '(begin 1 2 3 4)) 4)")
*/

// VARIABLE

/*
t("(list (variable? (variable 'alice)))")
t("(list (not (variable? 'alice)))")
t("(list (let ([a (variable 'alice)])\
            (begin\
              (variable-set! a 'home)\
              (list (variable-ref a) (variable-ref a))))\
         '(home home))")
*/


// HASHES

/*
t("(list (hash-count (hash))                             0)")
t("(list (hash-count (hash 'a 1))                        1)")
t("(list (hash-count (hash 'a 1 'b 2))                   2)")
t("(list (hash-count (hash 'a 1 'a 2 'b 3))              2)")
t("(list (hash-count (hash-set (hash 'a 1 'b 3) 'c 3))   3)")
t("(list (hash-count (hash-remove (hash 'a 1 'b 3) 'b))  1)")
t("(hash 'a 1 'a 2 'b 3)")
t("(list (hash-count (hash 'a 1 'a 2 'b 3)) 2)")
t("(list (hash-count (hash-set (hash) 'a 1)) 1)")
t("(list (hash-count (hash-set (hash-set (hash) 'a 41) 'a 42)) 1)")
t("(list (hash-count (hash-set (hash-set (hash-set (hash) 'a 41) 'a 42) 'a 43)) 1)")
*/


//js_display(format(kernel_eval(parse1(
//    '(module->hash "lib/rac/private/base/and-or.rac")'))))

//js_display(format(kernel_eval(parse1(
//    '(begin (arg-error \'who "what" 44) 45)'))))


js_write(getcwd())


