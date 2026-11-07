// SPDX-License-Identifier: EUPL-1.2
import { z } from 'zod';
import { registerRoute } from '../../../../../../../lib/server/http/openapi';
import { SettingsBody, SlugParams } from '../admin-schemas';
registerRoute({
	method: 'get',
	path: '/api/v1/m/{slug}/admin/settings',
	summary: 'Read the municipality settings',
	auth: 'admin',
	params: SlugParams,
	response: SettingsBody,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});

registerRoute({
	method: 'put',
	path: '/api/v1/m/{slug}/admin/settings',
	summary:
		'Replace the municipality settings (cancellation deadline 0-10080 min, maxDaysAhead 1-90, noShowThreshold 1-10, penaltyDays 0-90, primaryColor #RRGGBB, legalNotice/privacyPolicy/usageRules up to 20000 characters each)',
	auth: 'admin',
	params: SlugParams,
	body: SettingsBody,
	response: SettingsBody,
	errors: ['VALIDATION_FAILED', 'UNAUTHENTICATED', 'FORBIDDEN', 'NOT_FOUND']
});
