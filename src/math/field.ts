// BLS12-381 prime field Fp
// See docs/theory/01-groups-fields.md

// The BLS12-381 field prime p (381-bit).
// Source: https://github.com/zcash/librustzcash/blob/master/pairing/src/bls12_381/README.md
// p = 2^381 - 2^128 - 2^96 + 2^32 - 1
export const FP_MODULUS = BigInt(
  '0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab'
);

export const Fp = {
  // Reduce x into [0, p)
  mod(x: bigint): bigint {
    const r = x % FP_MODULUS;
    return r < 0n ? r + FP_MODULUS : r;
  },

  add(a: bigint, b: bigint): bigint {
    return Fp.mod(a + b);
  },

  sub(a: bigint, b: bigint): bigint {
    // a + p ensures non-negative before mod
    return Fp.mod(a - b + FP_MODULUS);
  },

  neg(a: bigint): bigint {
    return a === 0n ? 0n : FP_MODULUS - Fp.mod(a);
  },

  mul(a: bigint, b: bigint): bigint {
    return Fp.mod(a * b);
  },

  // Fast exponentiation: square-and-multiply, O(log exp)
  pow(base: bigint, exp: bigint): bigint {
    if (exp === 0n) return 1n;
    base = Fp.mod(base);
    let result = 1n;
    while (exp > 0n) {
      if (exp & 1n) result = Fp.mul(result, base);
      base = Fp.mul(base, base);
      exp >>= 1n;
    }
    return result;
  },

  // Multiplicative inverse via Fermat: a^{-1} = a^{p-2} mod p
  // See docs/theory/01-groups-fields.md - Fermat's little theorem
  inv(a: bigint): bigint {
    if (Fp.mod(a) === 0n) throw new Error('0 has no multiplicative inverse in Fp');
    return Fp.pow(a, FP_MODULUS - 2n);
  },
} as const;
