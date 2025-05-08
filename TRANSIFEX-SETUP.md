In Settings > Integrations > GitHub, the following should work for a transifex configuration:

```yml
git:
  filters:
  - filter_type: dir
    file_format: PO
    source_file_extension: po
    source_language: en
    source_file_dir: src/conf/locale/en_US/LC_MESSAGES
    translation_files_expression: 'src/conf/locale/<lang>/LC_MESSAGES/'
```