/**
 * @file schema.js
 * Defines the Paper data structure used throughout the application.
 * Papers are sourced from OpenAlex (https://openalex.org) and represent
 * academic publications with their metadata, classification, and citation info.
 */

/**
 * @typedef {Object} Paper
 *
 * ── Identity ────────────────────────────────────────────────────────────────
 * @property {string}      id                  OpenAlex work ID  (e.g. "W2741809807")
 * @property {string|null} doi                 Digital Object Identifier  (e.g. "10.48550/arXiv.1706.03762")
 * @property {string}      title               Full title of the paper
 *
 * ── Publication info ────────────────────────────────────────────────────────
 * @property {number}      publication_year    Four-digit year  (e.g. 2017)
 * @property {string|null} publication_date    ISO date string  (e.g. "2017-06-12")
 * @property {string}      type                OpenAlex work type  (e.g. "article", "preprint")
 * @property {string}      language            ISO 639-1 language code  (e.g. "en")
 *
 * ── Citation metrics ────────────────────────────────────────────────────────
 * @property {number}      cited_by_count          Number of works that cite this paper
 * @property {number}      referenced_works_count  Number of works this paper references
 *
 * ── Topic classification ────────────────────────────────────────────────────
 * @property {string}      domain          Top-level domain  (e.g. "Computer Science")
 * @property {string}      field           Mid-level field   (e.g. "Artificial Intelligence")
 * @property {string}      subfield        Subfield          (e.g. "Machine Learning")
 * @property {string}      primary_topic   Most prominent topic name
 * @property {string}      topics          Comma-separated topic names        e.g. "Topic1, Topic2"
 * @property {string}      concepts        Comma-separated top concept names  e.g. "Concept1, Concept2"
 * @property {string}      concepts_full   Full JSON-serialised concept objects (name + score + wikidata)
 * @property {string}      keywords        Comma-separated author-assigned keywords
 * @property {string}      keywords_full   Full JSON-serialised keyword objects
 *
 * ── Related works ───────────────────────────────────────────────────────────
 * @property {string}      references_full  JSON array of OpenAlex IDs this paper cites
 * @property {string}      related_full     JSON array of OpenAlex IDs of related works
 *
 * ── Access & content ────────────────────────────────────────────────────────
 * @property {string}      abstract    Plain-text abstract (may be null if not available)
 * @property {string}      is_oa       Open-access flag as string  "Yes" | "No"
 * @property {string|null} oa_url      URL of the best open-access PDF, or null
 * @property {string|null} license     SPDX license identifier  (e.g. "cc-by", "cc-by-nc")
 * @property {string|null} pdf_url     Direct PDF URL if known, otherwise null
 *
 * ── Source (journal / venue) ────────────────────────────────────────────────
 * @property {string}      source_id    OpenAlex source ID
 * @property {string}      source_name  Journal or conference name
 * @property {string}      source_type  "journal" | "conference" | "repository" | "other"
 *
 * ── Authors ─────────────────────────────────────────────────────────────────
 * @property {number}      num_authors       Total number of authors
 * @property {string}      authors           Semicolon-separated display names  "John Smith; Jane Doe"
 * @property {string}      author_ids        Comma-separated OpenAlex author IDs  "A123, A456"
 * @property {Object[]}    full_authors_info Array of author objects  [{ id, name, orcid, institutions }]
 *
 * ── Timestamps ──────────────────────────────────────────────────────────────
 * @property {string|null} created_at   ISO timestamp when the record was created in OpenAlex
 * @property {string|null} updated_at   ISO timestamp of the last OpenAlex update
 *
 * ── Article Processing Charges ──────────────────────────────────────────────
 * @property {string|null} APC_currency  Currency code for the APC  (e.g. "USD", "EUR")
 * @property {number|null} APC_value     APC amount in the stated currency
 * @property {number|null} APC_USD       APC amount normalised to USD
 */

/**
 * Empty Paper with all fields set to their default/null values.
 * Useful as a template or for unit tests.
 *
 * @type {Paper}
 */
export const EMPTY_PAPER = {
  id: '',
  doi: null,
  title: '',
  publication_year: 0,
  publication_date: null,
  type: 'article',
  language: 'en',
  cited_by_count: 0,
  referenced_works_count: 0,
  domain: '',
  field: '',
  subfield: '',
  primary_topic: '',
  topics: '',
  concepts: '',
  concepts_full: '[]',
  keywords: '',
  keywords_full: '[]',
  references_full: '[]',
  related_full: '[]',
  abstract: '',
  is_oa: 'No',
  oa_url: null,
  license: null,
  pdf_url: null,
  source_id: '',
  source_name: '',
  source_type: 'journal',
  num_authors: 0,
  authors: '',
  author_ids: '',
  full_authors_info: [],
  created_at: null,
  updated_at: null,
  APC_currency: null,
  APC_value: null,
  APC_USD: null,
};
