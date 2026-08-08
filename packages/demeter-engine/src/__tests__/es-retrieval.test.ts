import { describe, it, expect } from "vitest";
import { expandEsQuery, retrieve } from "../retrieval";

// ES retrieval expansion (T12): the corpus and its embeddings are English, so
// raw Spanish queries retrieved thin/empty grounding — the live eval showed
// ES cases degrading for exactly that reason. The glossary expansion is what
// retrieval sees; the user's question and the answer language are untouched.

describe("expandEsQuery", () => {
  it("appends the English SNAP terms a Spanish question implies", () => {
    const q = expandEsQuery("¿Cuál es la asignación máxima de CalFresh para una familia de 4?");
    expect(q).toContain("asignación máxima"); // original preserved
    expect(q).toContain("maximum allotment");
    expect(q).toContain("household size");
  });

  it("maps crisis and program vocabulary", () => {
    const q = expandEsQuery("Me robaron los beneficios de mi tarjeta EBT — ¿me los reponen?");
    expect(q).toContain("stolen benefits replacement");
    expect(q).toContain("EBT card");
    expect(q).toContain("replacement");
  });

  it("leaves queries without Spanish SNAP vocabulary unchanged", () => {
    expect(expandEsQuery("what is the income limit?")).toBe("what is the income limit?");
  });

  it("does not fire short stems inside longer unrelated words", () => {
    // Bare /auto/ used to match inside "autorización" and inject vehicle terms.
    expect(expandEsQuery("necesito la autorización del condado")).not.toContain("vehicle");
    // …while the real vehicle words still expand.
    for (const q of ["mi carro", "mi automóvil", "el vehículo de mi esposo", "un auto viejo"]) {
      expect(expandEsQuery(q), q).toContain("vehicle");
    }
  });

  it("expands all three Spanish starter questions the chat ships", () => {
    // Unaccented spellings too — users type without accents constantly.
    const starters = [
      "¿Cuál es el límite de ingresos para mi hogar?",
      "Cual es el limite de ingresos para mi hogar?",
      "¿Qué tan rápido puedo recibir beneficios en una emergencia?",
      "Que tan rapido puedo recibir beneficios en una emergencia?",
      "¿Tengo que hacer una entrevista por teléfono?",
      "Tengo que hacer una entrevista por telefono?",
    ];
    for (const q of starters) {
      expect(expandEsQuery(q), q).not.toBe(q); // something expanded
    }
  });
});


describe("retrieve with lang: es", () => {
  it("grounds the ES expedited question in the expedited-service regulation", async () => {
    const chunks = await retrieve("¿Qué tan rápido puedo recibir CalFresh en una emergencia?", {
      state: "CA",
      lang: "es",
    });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.some((c) => c.citation.includes("273.2"))).toBe(true);
  });

  it("grounds the ES income question at least as well as its English twin", async () => {
    const es = await retrieve("¿Cuál es el límite de ingresos para una familia de 3?", {
      state: "CA",
      lang: "es",
    });
    const en = await retrieve("What is the income limit for a family of 3?", { state: "CA" });
    expect(es.length).toBeGreaterThan(0);
    const enCites = new Set(en.map((c) => c.citation));
    expect(es.some((c) => enCites.has(c.citation))).toBe(true);
  });
});
