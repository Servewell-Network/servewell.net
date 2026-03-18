export interface Morpheme { // unit of meaning = word or part of word
  "MorphemeId"?: string; // e.g., "Gen1:1.1"
  "WordNumber"?: number; // because morphemes are often grouped in Semitic (Hebrew/Aramaic)
  "OriginalMorphemeScript": string; // unicode of Aramaic/Greek characters
  "OriginalMorphemeTransliteration"?: string; // sounds for English readers
  "OriginalMorphemeVerbalAspect"?: 'Whole Action' | 'Progressing Action'; // whole is traditionally called perfect; is there a repeated also?
  "OriginalMorphemeVerbalTenseOrTime"?: 'Past' | 'Present' | 'Future';
  "OriginalMorphemeVerbalPerson"?: 'First Person' | 'Second Person' | 'Third Person';
  "OriginalMorphemeVerbalNumber"?: 'Singular' | 'Plural';
  "EnglishMorphemeWithPunctuationInOriginalOrder": string;
  "IsPunctuation"?: boolean; // probably lighter gray
  "EnglishMorphemeWithPunctuationInEnglishOrder"?: string; // require later
  "AlternateEnglishInOriginalOrder"?: string[];
  "AlternateEnglishInEnglishOrder"?: string[];
  "OriginalLexemeScript"?: string; // example binyan like Hiphil or Piel, sometimes ambiguous
  "OriginalLexemeTransliteration"?: string;
  "OriginalLexemeDetail"?: string;
  "EnglishLexemeTranslation"?: string;
  "OriginalRootScript"?: string;
  "OriginalRootTransliteration"?: string;
  "OriginalRootStrongsID": string;
  "ConstituentRootIds"?: string[];
  "OriginalRootDetail"?: string;
  "EnglishRootTranslation"?: string;
  "EnglishSenseInformation"?: string; // e.g., definition 1 with example gloss(es)
  "EnglishSubstitutionInfo"?: string; // reliably used as substitute for X in Y context
  "OriginalLanguage"?: "Hebrew" | "Aramaic" | "Greek";
  "OriginalMorphemeOrdinal": number; // orig position, redundant in array
  "EnglishMorphemeOrdinal"?: number; // where it's needed for English
  "Indentations"?: number; // -1 means no new line
  "Source"?: string; // e.g., L for Leningrad Codex
  "MeaningVariants"?: string[];
}
export interface EnglishWordInfo {
    "EnglishWord": string;
    "StrongsId"?: string; // once we know enough morpheme IDs, can remove this field
    "OriginalMorphemeId"?: string;
}
export interface EnglishInsertion {
    "InsertionType": 'Heading' | 'Cross Ref.' | 'Paragraph Start' | 'Space' | 'Footnotes' | 'End Text';
    'Text': string;
}
export interface Snippet { // allows partial verses, plus 'verse' is misleading
  "SnippetId"?: string; // e.g., "Gen1:1" for verse, "Gen1:1a" for partial verse
  "SnippetNumber": number; // verse like 12 or partial verse like 12.1 
  "CommentLinkTextsAndUrls"?: string[],
  "PreceedingComment"?: string;
  "OriginalMorphemes": Morpheme[]
  "EnglishHeadingsAndWords": (EnglishWordInfo | EnglishInsertion)[];
}
export interface Chapter {
  "DocumentOrBook": string; // e.g., "Genesis"
  "DocOrBookAbbreviation": string; // e.g., "Gen"
  "PaddedNumWithDocAbbr": string; // e.g., "01-Gen"
  "ChapterNumber": number; // e.g., 3
  "PaddedChapterNumber": string; // e.g., "003"
  "ChapterId": string; // e.g., "Gen3"
  "NumPrecedingVersesToInclude": number; // link text for prev chapter
  "SnippetsAndExplanations": Snippet[]; // verses for now
  "NumFollowingVersesToInclude": number; // link text for next chapter
}
