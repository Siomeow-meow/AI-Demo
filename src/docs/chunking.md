# Chunking Strategy

Chunking controls how documents are split before indexing. Chunks that are too large dilute the relevant signal and waste context window; chunks that are too small lose surrounding meaning.

A common starting point is 200 to 500 words per chunk with a small overlap between neighbouring chunks so that sentences cut at a boundary still appear whole in at least one chunk. Splitting on paragraph boundaries first usually keeps ideas intact.
