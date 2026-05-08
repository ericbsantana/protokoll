# The Name

The word is German. It means *protocol*.

---

## The Vienna Circle

In the 1920s, a group of philosophers, mathematicians, and scientists gathered in Vienna. They called themselves the **Wiener Kreis** - the Vienna Circle. Their members included Rudolf Carnap, Otto Neurath, Hans Hahn, Friedrich Waismann, and Moritz Schlick.

Their project was radical: to subject every meaningful statement to a single test. A statement was meaningful *if and only if* it was, in principle, verifiable. Metaphysics, theology, and empty tautology would fail the test. What remained was science - claims that corresponded to experience and could be checked.

They called the basic units of verification **Protokollsätze**: protocol sentences. A protocol sentence is a minimal empirical record - what an observer actually saw, measured, or computed at a specific moment. The term comes from the Greek *protokollon*: the first sheet glued to a manuscript, bearing the notary's mark. The original certificate. The verifiable ground floor.

Neurath and Carnap debated whether protocol sentences described inner experience or physical states. They disagreed on the details. But both agreed on the core: knowledge must bottom out in something checkable.

---

## The VRF as Protocol Sentence

A VRF proof is a protocol sentence in this exact sense.

For any `(k, roundId)` pair, there is exactly one valid output `β`. The DLEQ proof is the record - the minimal checkable statement that the oracle used key `k` to derive `β` from `roundId`. Anyone with the public key can verify it. No one can produce a valid proof with a different `β`. The math enforces what the Vienna Circle only demanded in principle.

```
β = sha256(k · H(roundId))
```

This is not a claim that can be disputed once the proof exists. The on-chain verifier either accepts or rejects. There is no interpretation, no trust, no rhetoric. The proof is the ground floor - the original certificate.

When a node submits `(γ, c, s)` to the verifier, it is filing a protocol sentence. The contract checks: does this record follow from the stated rules? If yes, `β` is accepted. If no, it is rejected. Neurath would recognize the structure.

---

## The Protocol Layer

The word carries a second meaning that arrives for free: blockchain infrastructure. Every smart contract system runs on a protocol - a set of rules that determines which state transitions are valid. Protokoll names both layers simultaneously:

- the verifiability criterion applied to randomness
- the infrastructure layer it lives on

The two meanings are not coincidental. They share the same root: something is valid because it can be checked, and what can be checked is determined by the rules.

---

## Further Reading

- Otto Neurath, *Protocol Sentences* (1932) - the original formulation of Protokollsätze
- Rudolf Carnap, *The Unity of Science* (1934) - the verifiability principle developed
- A.J. Ayer, *Language, Truth and Logic* (1936) - the English-language popularisation
- [DLEQ proofs explained](/whitepaper#4-3-the-dleq-proof) - the math that makes the analogy precise
