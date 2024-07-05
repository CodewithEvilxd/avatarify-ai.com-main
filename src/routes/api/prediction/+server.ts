import type { RequestHandler } from './$types';
import { error as svelteError, json } from '@sveltejs/kit';
import { getSupabase } from '@supabase/auth-helpers-sveltekit';
import { supabaseClientAdmin } from '$lib/db.server';
import { getAdminUserInfo, handleError } from '$lib/db';
import { getNegativePrompt, getReplacedPrompt } from '$lib/prompts.server';
import { getPredictionStatus, runPrediction } from '$lib/replicate.server';
import { getPrompt } from '$lib/themes';
import type { PostgrestResponse } from '@supabase/supabase-js';
import { getLimitedQuantity } from '$lib/predictions.server';

interface GeneratePayload {
	theme: string | undefined;
	prompt: string | undefined;
	seed: string | undefined;
	quantity: number | string | undefined;
}
export const GET: RequestHandler = async (event) => {
	try {
		const predictionID = event.url.searchParams.get('id');
		const { session } = await getSupabase(event);

		if (!predictionID) {
			throw new Error('Prediction ID not valid');
		}
		if (!session) {
			throw new Error('Session not valid');
		}

		const userInfo = await getAdminUserInfo(session.user.id, supabaseClientAdmin);

		if (!userInfo.paid) {
			throw new Error('Payment required');
		}

		if (userInfo.in_training || !userInfo.trained || !userInfo.replicate_version_id) {
			throw new Error('Model not trained');
		}

		if (userInfo.counter >= 100) {
			throw new Error('You cannot generate more than 100 photos');
		}

		const predictionResponse = await getPredictionStatus(predictionID);
		console.log('Predict response', predictionResponse);

		const { error } = await supabaseClientAdmin.from('predictions').upsert({
			id: predictionResponse.id,
			user_id: session.user.id,
			status: predictionResponse.status
		});
		if (error) {
			throw new Error('Error on insert prediction', { cause: error });
		}
		const [url] = predictionResponse.output || [];
		if (url) {
			const image = await fetch(url);
			handleError(
				await supabaseClientAdmin.storage
					.from('photos-generated')
					.upload(`${session.user.id}/${predictionResponse.id}.jpg`, await image.arrayBuffer())
			);
		} else {
			throw new Error('Missing url', {
				cause: predictionResponse
			});
		}

		return json({ done: true });
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			console.error(error.cause);
			throw svelteError(500, { message: error.message });
		}
		throw svelteError(500);
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const body = (await event.request.json()) as GeneratePayload;
		const { theme, seed } = body;
		let { prompt, quantity = 1 } = body;

		if (theme) {
			prompt = getPrompt(theme);
		}
		if (!prompt) {
			throw new Error('Theme not selected');
		}
		const { session } = await getSupabase(event);

		if (!session) {
			throw new Error('Session not valid');
		}

		const user = session.user;
		console.log('user', user);

		const userInfo = await getAdminUserInfo(session.user.id, supabaseClientAdmin);

		if (!userInfo.paid) {
			throw new Error('Payment required');
		}

		if (userInfo.in_training || !userInfo.trained || !userInfo.replicate_version_id) {
			throw new Error('Model not trained');
		}

		const negativePrompt = getNegativePrompt();
		console.log({ prompt, negativePrompt, seed });

		if (typeof quantity == 'string') {
			quantity = parseInt(quantity);
			if (isNaN(quantity)) {
				throw new Error('Wrong quantity');
			}
		}
		quantity = getLimitedQuantity(quantity);
		const quantityLimit = 100;
		if (quantity > quantityLimit - userInfo.counter) {
			if (quantityLimit - userInfo.counter > 0) {
				quantity = quantityLimit - userInfo.counter;
			} else {
				throw new Error('You have already generated 100 photos');
			}
		}

		const promises: Promise<PostgrestResponse<undefined>>[] = [];
		for (let i = 0; i < quantity; i++) {
			promises.push(
				runPrediction(
					userInfo.replicate_version_id,
					getReplacedPrompt(prompt, userInfo.instance_class),
					negativePrompt,
					seed,
					user
				).then((predictionResponse) => {
					console.log('Predict response', predictionResponse);
					return supabaseClientAdmin.from('predictions').insert({
						id: predictionResponse.id,
						user_id: session.user.id,
						status: predictionResponse.status
					});
				})
			);
		}

		await Promise.all(promises)
			.then((responses) => {
				for (let i = 0; i < responses.length; i++) {
					if (responses[i].error) {
						throw new Error('Error on insert prediction', { cause: responses[i].error });
					}
				}
			})
			.catch((err) => {
				throw new Error('Error on insert prediction', { cause: err });
			});

		handleError(
			await supabaseClientAdmin
				.from('user_info')
				.update({
					counter: userInfo.counter + quantity
				})
				.eq('id', session.user.id)
		);

		return json({ done: true });
	} catch (error) {
		console.error(error);
		if (error instanceof Error) {
			console.error(error.cause);
			throw svelteError(500, { message: error.message });
		}
		throw svelteError(500);
	}
};
