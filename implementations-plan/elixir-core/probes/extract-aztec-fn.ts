// Extract one private function's bytecode from an Aztec contract artifact into a program-shaped JSON
// that `bb gates -b <file> --scheme chonk` accepts (Aztec app functions are Mega circuits; the
// `ultra_honk` scheme refuses their CallData/ReturnData blocks).
// usage: bun extract-aztec-fn.ts target/<pkg>-<Contract>.json <fn_name> [out.json]
const [artifactPath, fnName, out = `target/fn-${process.argv[3]}.json`] = process.argv.slice(2);
const art = await Bun.file(artifactPath).json();
const f = art.functions.find((x: { name: string }) => x.name.replace("__aztec_nr_internals__", "") === fnName);
if (!f) throw new Error(`function ${fnName} not found; have: ${art.functions.map((x: { name: string }) => x.name).join(", ")}`);
await Bun.write(out, JSON.stringify({ noir_version: art.noir_version, hash: f.hash ?? 0, abi: f.abi, bytecode: f.bytecode, debug_symbols: f.debug_symbols ?? "", file_map: {}, names: [fnName], brillig_names: [] }));
console.log("wrote", out);
