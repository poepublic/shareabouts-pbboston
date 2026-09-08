"""
Ballots module for Shareabouts Vote App
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

Contains code for managing ballots, including loading ballot proposal
information from Markdown and YAML files, and modifying ballot proposals in the
repository.
"""

from datetime import date, datetime
import json
import pathlib
from typing import TypedDict, Self

import frontmatter
import markdown
import yaml


DEFAULT_LANG = 'en'


class BallotProposal(TypedDict):
    slug: str
    title: str
    description: str
    description_html: str
    image: str
    image_alt: str
    amount: int
    last_updated: str


class Ballot:
    """
    Represents a list of ballot proposals.
    """

    def __init__(self, proposals: list[BallotProposal]):
        self.proposals = proposals

    @classmethod
    def from_directory(cls, directory: str | pathlib.Path, lang: str = DEFAULT_LANG, fallback_langs: list[str] | None = None) -> Self:
        """
        Load a ballot from a directory containing proposal files.

        :param directory: The path to the directory containing proposal files.
        :param lang: The primary language code to load proposal files.
        :param fallback_langs: A list of fallback language codes to try if the primary language files are not found.
        :return: A Ballot instance with loaded proposals.
        """
        ballot_dir = pathlib.Path(directory)

        if not ballot_dir.is_dir():
            raise ValueError(f"The provided path '{directory}' is not a valid directory.")

        proposals = []
        for proposal_dir in ballot_dir.iterdir():
            if not proposal_dir.is_dir():
                continue  # Skip non-directory files

            # Verify that the proposal directory contains the required files
            common_info_path = proposal_dir / "info.yaml"
            if not common_info_path.exists():
                raise ValueError(f"Missing 'info.yaml' in proposal directory '{proposal_dir}'.")

            if fallback_langs is None:
                fallback_langs = [DEFAULT_LANG]
            for try_lang in [lang, *(l for l in fallback_langs if l != lang)]:
                lang_info_path = proposal_dir / f"{try_lang}.md"
                if lang_info_path.exists():
                    break
            else:
                raise ValueError(f"Missing proposal files for languages '{[lang, *fallback_langs]}' in '{proposal_dir}'.")

            # Load the proposal information from the files
            with lang_info_path.open('r', encoding='utf-8') as lang_info_file:
                lang_info = frontmatter.load(lang_info_file)

            with common_info_path.open('r', encoding='utf-8') as common_info_file:
                common_info = yaml.safe_load(common_info_file)

            proposal = BallotProposal(
                slug=proposal_dir.name,
                title=lang_info.get("title", ""),
                description=lang_info.content,
                description_html=markdown.markdown(lang_info.content),
                image=common_info.get("image", ""),
                image_alt=lang_info.get("image_alt", ""),
                amount=common_info.get("amount", 0),
                last_updated=common_info.get("last_updated", ""),
            )
            proposals.append(proposal)

        return cls(proposals)

    @classmethod
    def from_config(
        cls,
        config,
        lang: str = DEFAULT_LANG,
        fallback_langs: list[str] | None = None
    ) -> Self:
        """
        Load a ballot from a Shareabouts configuration instance.
        """
        if hasattr(config, 'path'):
            flavor_dir = pathlib.Path(config.path)
        elif isinstance(config, dict) and 'path' in config:
            flavor_dir = pathlib.Path(config['path'])
        else:
            flavor_dir = pathlib.Path(settings.SHAREABOUTS['CONFIG'])

        ballot_config = config.get('ballot', {}) if hasattr(config, 'get') else {}
        proposals_folder = ballot_config.get('proposals_folder', 'ballot') if isinstance(ballot_config, dict) else 'ballot'
        proposals_dir = flavor_dir / proposals_folder

        if not proposals_dir.is_dir():
            return cls([])

        return cls.from_directory(proposals_dir, lang=lang, fallback_langs=fallback_langs)

    @property
    def slugs(self) -> set[str]:
        """
        Return the set of proposal slugs in this ballot.
        """
        return {p['slug'] for p in self.proposals}

    def to_dict(self) -> dict[str, list[BallotProposal]]:
        """
        Convert the Ballot instance to a dictionary representation.

        :return: A dictionary with a single key 'proposals' containing the list of proposals.
        """
        return {"proposals": self.proposals}

    def to_json(self, **json_kwargs) -> str:
        """
        Convert the Ballot instance to a JSON string.

        :return: A JSON string representation of the ballot.
        """
        def json_serial(obj):
            """JSON serializer for objects not serializable by default json code"""
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            raise TypeError("Type %s not serializable" % type(obj))
        
        json_kwargs.setdefault('ensure_ascii', False)
        json_kwargs.setdefault('default', json_serial)
        return json.dumps(self.to_dict(), **json_kwargs)
