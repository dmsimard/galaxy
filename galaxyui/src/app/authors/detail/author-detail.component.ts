import { Component, OnInit } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';

import * as moment from 'moment';

import { ActionConfig } from 'patternfly-ng/action/action-config';
import { EmptyStateConfig } from 'patternfly-ng/empty-state/empty-state-config';
import { Filter } from 'patternfly-ng/filter/filter';
import { FilterConfig } from 'patternfly-ng/filter/filter-config';
import { FilterEvent } from 'patternfly-ng/filter/filter-event';
import { FilterField } from 'patternfly-ng/filter/filter-field';
import { FilterType } from 'patternfly-ng/filter/filter-type';
import { ListConfig } from 'patternfly-ng/list/basic-list/list-config';
import { ListEvent } from 'patternfly-ng/list/list-event';
import { PaginationConfig } from 'patternfly-ng/pagination/pagination-config';
import { PaginationEvent } from 'patternfly-ng/pagination/pagination-event';
import { SortConfig } from 'patternfly-ng/sort/sort-config';
import { SortEvent } from 'patternfly-ng/sort/sort-event';
import { ToolbarConfig } from 'patternfly-ng/toolbar/toolbar-config';

import { Namespace } from '../../resources/namespaces/namespace';
import { PFBodyService } from '../../resources/pf-body/pf-body.service';

import { AuthService } from '../../auth/auth.service';
import { Repository } from '../../resources/repositories/repository';
import { UserPreferences } from '../../resources/preferences/user-preferences';
import { PreferencesService } from '../../resources/preferences/preferences.service';
import { RepoCollectionListService } from '../../resources/combined/combined.service';
import { PaginatedRepoCollection } from '../../resources/combined/combined';
import { CollectionList } from '../../resources/collections/collection';

import {
    ContentTypes,
    ContentTypesIconClasses,
    ContentTypesPluralChoices,
} from '../../enums/content-types.enum';

import {
    RepoFormats,
    RepoFormatsIconClasses,
    RepoFormatsTooltips,
} from '../../enums/repo-types.enum';

@Component({
    selector: 'app-author-detail',
    templateUrl: './author-detail.component.html',
    styleUrls: ['./author-detail.component.less'],
})
export class AuthorDetailComponent implements OnInit {
    // Used to track which component is being loaded
    componentName = 'AuthorDetailComponent';

    constructor(
        private router: Router,
        private route: ActivatedRoute,
        private repoCollectionListService: RepoCollectionListService,
        private pfBody: PFBodyService,
        private authService: AuthService,
        private preferencesService: PreferencesService,
    ) {}

    pageTitle = '';
    pageIcon = '';
    pageLoading = true;

    namespace: Namespace;
    repositories: Repository[] = [];
    repoCount: number;
    collections: CollectionList[] = [];
    collectionCount: number;

    emptyStateConfig: EmptyStateConfig;
    nameEmptyStateConfig: EmptyStateConfig;
    authorNotFound = false;
    toolbarActionConfig: ActionConfig;
    filterConfig: FilterConfig;
    sortConfig: SortConfig;
    toolbarConfig: ToolbarConfig;
    listConfig: ListConfig;
    paginationConfig: PaginationConfig;

    pageSize = 10;
    pageNumber = 1;
    filterBy: any = {};
    sortBy = 'name';
    isFollower = false;
    followerClass = 'fa fa-user-plus';

    preferences: UserPreferences = null;

    RepoFormats: typeof RepoFormats = RepoFormats;

    ngOnInit() {
        this.pfBody.scrollToTop();

        this.emptyStateConfig = {
            info: '',
            title: 'No repositories match your search',
            iconStyleClass: 'pficon pficon-filter',
        } as EmptyStateConfig;

        this.filterConfig = {
            fields: [
                {
                    id: 'name',
                    title: 'Name',
                    placeholder: 'Filter by Name...',
                    type: FilterType.TEXT,
                },
                {
                    id: 'type',
                    title: 'Type',
                    placeholder: 'Filter by Collection or Role...',
                    type: FilterType.SELECT,
                    queries: [
                        {
                            id: 'collection',
                            value: 'Collection',
                        },
                        {
                            id: 'repository',
                            value: 'Role',
                        },
                    ],
                },
            ] as FilterField[],
            resultsCount: 0,
            appliedFilters: [] as Filter[],
        } as FilterConfig;

        this.sortConfig = {
            fields: [
                {
                    id: 'name',
                    title: 'Name',
                    sortType: 'alpha',
                },
                {
                    id: 'download_count',
                    title: 'Downloads',
                    sortType: 'numeric',
                },
            ],
            isAscending: true,
        } as SortConfig;

        this.toolbarActionConfig = {
            primaryActions: [],
            moreActions: [],
        } as ActionConfig;

        this.toolbarConfig = {
            actionConfig: this.toolbarActionConfig,
            filterConfig: this.filterConfig,
            sortConfig: this.sortConfig,
            views: [],
        } as ToolbarConfig;

        this.listConfig = {
            dblClick: false,
            multiSelect: false,
            selectrepositories: false,
            selectionMatchProp: 'name',
            showCheckbox: false,
            useExpandItems: false,
            emptyStateConfig: this.emptyStateConfig,
        } as ListConfig;

        this.paginationConfig = {
            pageSize: 10,
            pageNumber: 1,
            totalItems: 0,
        } as PaginationConfig;

        this.route.data.subscribe(data => {
            this.namespace = data['namespace'];

            this.setStateFromResponse(data['content']);

            if (this.namespace && this.namespace.name) {
                this.authService.me().subscribe(me => {
                    if (me.authenticated) {
                        this.preferencesService.get().subscribe(result => {
                            this.preferences = result;
                            this.setFollower();
                        });
                    }
                });
                if (this.namespace.is_vendor) {
                    this.pageTitle = `Partners;/partners;${
                        this.namespace.name
                    }`;
                    this.pageIcon = 'fa fa-star';
                } else {
                    this.pageTitle = `Community Authors;/community;${
                        this.namespace.name
                    }`;
                    this.pageIcon = 'fa fa-users';
                }
                this.parepareNamespace();
                if (this.repositories && this.repositories.length) {
                    this.prepareRepositories();
                }
            } else {
                // author not found
                this.router.navigate(['/not-found']);
            }
        });
    }

    handleListClick($event: ListEvent): void {
        const repository = $event.item;
        this.router.navigate([
            '/',
            repository.summary_fields['namespace']['name'],
            repository.name,
        ]);
    }

    filterChanged($event: FilterEvent): void {
        this.filterBy = {};
        if ($event.appliedFilters.length) {
            const newApplied = [];
            $event.appliedFilters.forEach((filter: Filter) => {
                if (filter.field.type !== 'select') {
                    for (const val of filter.value.split(' ')) {
                        if (val !== '') {
                            newApplied.push({
                                field: filter.field,
                                value: val,
                            });
                        }
                    }
                } else {
                    newApplied.push(filter);
                }
            });

            this.filterConfig.appliedFilters = newApplied;

            this.filterConfig.appliedFilters.forEach((filter: Filter) => {
                if (filter.field.type === 'select') {
                    this.filterBy[filter.field.id] = filter.query.id.trim();
                } else {
                    if (this.filterBy[filter.field.id]) {
                        this.filterBy[filter.field.id] +=
                            ' ' + filter.value.trim();
                    } else {
                        this.filterBy[filter.field.id] = filter.value.trim();
                    }
                }
            });
        }
        this.pageNumber = 1;
        this.searchRepositories();
    }

    sortChanged($event: SortEvent): void {
        if ($event.isAscending) {
            this.sortBy = $event.field.id;
        } else {
            this.sortBy = '-' + $event.field.id;
        }
        this.searchRepositories();
    }

    handlePageSizeChange($event: PaginationEvent) {
        if ($event.pageSize && this.pageSize !== $event.pageSize) {
            this.pageSize = $event.pageSize;
            this.pageNumber = 1;
            this.searchRepositories();
        }
    }

    handlePageNumberChange($event: PaginationEvent) {
        if ($event.pageNumber && this.pageNumber !== $event.pageNumber) {
            this.pageNumber = $event.pageNumber;
            this.searchRepositories();
            this.pfBody.scrollToTop();
        }
    }

    followUser() {
        this.followerClass = 'fa fa-spin fa-spinner';
        if (this.isFollower) {
            const index = this.preferences.namespaces_followed.indexOf(
                this.namespace.id,
            );
            this.preferences.namespaces_followed.splice(index, 1);
        } else {
            this.preferences.namespaces_followed.push(this.namespace.id);
        }
        this.preferencesService.save(this.preferences).subscribe(result => {
            if (result !== null) {
                this.preferences = result;
                this.setFollower();
            }
        });
    }

    // private

    private setStateFromResponse(data: PaginatedRepoCollection) {
        this.repositories = data['repository']['results'];
        this.collections = data['collection']['results'];

        this.repoCount = data['repository']['count'];
        this.collectionCount = data['collection']['count'];

        this.pageLoading = false;
        this.paginationConfig.totalItems =
            this.repoCount + this.collectionCount;
        this.filterConfig.resultsCount = this.repoCount + this.collectionCount;
    }

    private setFollower() {
        if (
            this.preferences.namespaces_followed.find(
                x => x === this.namespace.id,
            ) !== undefined
        ) {
            this.isFollower = true;
            this.followerClass = 'fa fa-user-times';
        } else {
            this.isFollower = false;
            this.followerClass = 'fa fa-user-plus';
        }
    }

    private searchRepositories() {
        this.pageLoading = true;
        this.filterBy['namespace'] = this.namespace.name;
        this.filterBy['order'] = this.sortBy;
        this.filterBy['page_size'] = this.pageSize;
        this.filterBy['page'] = this.pageNumber;
        this.repoCollectionListService
            .query(this.filterBy)
            .subscribe(response => {
                this.setStateFromResponse(response);
                this.prepareRepositories();
            });
    }

    private parepareNamespace() {
        // Creat an array of {'Content Type': {count: <int>, iconClass: 'icon-class'}}
        const contentCounts = [];
        for (const ct in ContentTypes) {
            if (ct === ContentTypes.plugin) {
                // summarize plugins
                let count = 0;
                const countObj = {};
                for (const count_key in this.namespace['summary_fields'][
                    'content_counts'
                ]) {
                    if (count_key.indexOf('plugin') > -1) {
                        count += this.namespace['summary_fields'][
                            'content_counts'
                        ][count_key];
                    }
                }
                if (count > 0) {
                    countObj['title'] = ContentTypesPluralChoices[ct];
                    countObj['count'] = count;
                    countObj['iconClass'] = ContentTypesIconClasses[ct];
                    contentCounts.push(countObj);
                }
            } else if (
                this.namespace['summary_fields']['content_counts'][
                    ContentTypes[ct]
                ] > 0
            ) {
                const countObj = {};
                countObj['title'] = ContentTypesPluralChoices[ct];
                countObj['count'] = this.namespace['summary_fields'][
                    'content_counts'
                ][ContentTypes[ct]];
                countObj['iconClass'] = ContentTypesIconClasses[ct];
                contentCounts.push(countObj);
            }
        }
        this.namespace['contentCounts'] = contentCounts;

        if (!this.namespace.avatar_url) {
            this.namespace.avatar_url = '/assets/avatar.png';
        }
    }

    private prepareRepositories() {
        this.repositories.forEach((item: Repository) => {
            if (!item.format) {
                item.format = 'role';
            }
            item['iconClass'] = RepoFormatsIconClasses[item.format];
            item['tooltip'] = RepoFormatsTooltips[item.format];

            item.last_import = 'NA';
            item.last_import_state = 'NA';
            if (
                item.summary_fields['latest_import'] &&
                item.summary_fields['latest_import']['finished']
            ) {
                item.last_import = moment(
                    item.summary_fields['latest_import']['finished'],
                ).fromNow();
                item.last_import_state =
                    item.summary_fields['latest_import']['state'];
            }

            item.last_commit = 'NA';
            if (item.commit_created) {
                item.last_commit = moment(item.commit_created).fromNow();
            }
            // FIXME
            // item.download_count = 0;

            if (!item.description) {
                // Legacy Repository objects are missing a description. Will get fixed on first import.
                if (item.summary_fields['content_objects']) {
                    for (const contentObject of item.summary_fields
                        .content_objects) {
                        if (contentObject.description) {
                            item.description = contentObject.description;
                            break;
                        }
                    }
                }
            }
        });
    }
}
