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

To generate translations, you can use the following command:

```bash
honcho run src/manage.py flavormessages \
--locale ar \
--locale en \
--locale es \
--locale ht \
--locale pt_BR \
--locale so \
--locale vi \
--locale zh_Hans \
--keep-config  # <-- Keeps the .py file with the config.yml source strings
```

This will create `.po` files in a `src/conf/locale`. Those files will be uploaded to Transifex when you push to the approrpiate branch. The `--keep-config` option is useful for debugging, as it keeps the config file with the source strings. You can remove it after you are done debugging.