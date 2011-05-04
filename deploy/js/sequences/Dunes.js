var Dunes = function ( shared ) {

	var that = this;

	SequencerItem.call( this );

	// signals
	
	shared.signals.initscenes.add( initScene );

	var CAMERA_LOWEST_Y = 10;
	var CAMERA_LOWEST_Y_NULL_ATTENUATION = 200;
	var CAMERA_HIGHEST_Y = 4500;
	var CAMERA_FORWARD_SPEED = 10;
	var CAMERA_FORWARD_SPEED_MAX = 20;
	var CAMERA_FORWARD_SPEED_MAX_Y = 3000;
	var CAMERA_VERTICAL_FACTOR = 20;
	var CAMERA_VERTICAL_LIMIT = 50;
	var CAMERA_HORIZONTAL_FACTOR = 15;
	var CAMERA_INERTIA = 0.02;
	var CAMERA_ROLL_FACTOR = 0.4;
	var CAMERA_COLLISION_SLOWDOWN_DISTANCE = 50;
	var CAMERA_COLLISION_DISTANCE = 200;			// if this+slowdown > 280 there's a collision with a mysterious box collider
	var CAMERA_COLLISION_DISTANCE_SIDES = 40;
	var CAMERA_COLLISION_DISTANCE_DOWN = 50;
	var CAMERA_COLLISION_DISTANCE_UP = 40;
	var CAMERA_TARGET_ADJUSTMENT_FACTOR = 15;
	var CAMERA_LIFT_SPEED = 6;
	var CAMERA_START_LIFT = 0.29;
	var CAMERA_END_LIFT = 0.375;
	var CAMERA_DOWN_COLLISION_OFFSET = 100;

	// private variables
	
	var wantedCamera;
	var wantedCameraTarget;
	var wantedCameraDirection = new THREE.Vector3();
	var wantedCameraSpeedFactor = { forward: 1, left: 1, right: 1, up: 1, down: 1 };
	var cameraSpeedFactor = 0;
	var cameraCollisionSwitcher = 0;
	var camera, world, soup;
	var renderer = shared.renderer; 
	var renderTarget = shared.renderTarget;
	var ray = new THREE.Ray();



	//--- Init ---

	function initScene () {
		
		console.log( "dunes initScene" );
		
		that.update( 0.0009, 49.99, 90375 );

	};

	this.init = function () {

		camera = new THREE.Camera( 50, shared.viewportWidth / shared.viewportHeight, 1, 100000 );
		camera.target.position.set( 0, 0, -100 );

		wantedCamera = new THREE.Object3D();
		wantedCameraTarget = new THREE.Object3D();
		wantedCameraTarget.position.set( 0, 0, -100 );
		
		world = new DunesWorld( shared );
		soup = new DunesSoup( camera, world.scene, shared );
		//soup = new UgcSoup( camera, world.scene, shared );

		world.scene.addChild( camera );
		world.scene.addChild( camera.target );
		world.scene.addChild( wantedCamera );
		world.scene.addChild( wantedCameraTarget );

		shared.worlds.dunes = world;
		shared.sequences.dunes = this;
		
		console.log( "dunes init" );

	};


	//--- show & hide ---

	this.show = function ( progress ) {

		this.resetCamera();
		shared.started.dunes = true;
		
		console.log( "show dunes" );

	};

	this.hide = function () {

	};


	//--- reset camera ---

	this.resetCamera = function() {

		// look at prairie island
		
		wantedCamera.position.set( 0, 50, 0 );
		wantedCameraTarget.position.set( 0, 50, -500 );
		wantedCameraTarget.position.subSelf( wantedCamera.position ).normalize().multiplyScalar( CAMERA_COLLISION_DISTANCE ).addSelf( wantedCamera.position );
		
		camera.position.copy( wantedCamera.position );
		camera.target.position.copy( wantedCameraTarget.position );
		
		renderer.setClearColor( world.scene.fog.color );

	};
	

	//--- update ---

	this.update = function ( progress, delta, time ) {

		this.updateCamera( progress, delta, time );

		THREE.AnimationHandler.update( delta );

		world.update( delta, camera, false );
		soup.update( delta );

		renderer.render( world.scene, camera, renderTarget );

	};
	
	
	//--- update camera ---

	this.updateCamera = function( progress, delta, time ) {
		
		delta = delta * ( 1000 / 30 ) / 1000; 
		
		// check collision round-robin (can't afford to do all every frame)

		var minDistance, beginSlowDownDistance, direction;

		switch( cameraCollisionSwitcher ) {
			
			case 0:	
				
				direction = "forward";
				ray.origin.copy( wantedCamera.matrixWorld.getPosition());
				ray.direction.copy( camera.matrixWorld.getColumnZ().negate());
				
				minDistance = CAMERA_COLLISION_DISTANCE;
				beginSlowDownDistance = CAMERA_COLLISION_SLOWDOWN_DISTANCE;
				break;
			
			case 1:
				
				direction = "left";
				ray.origin.copy( wantedCamera.matrixWorld.getPosition());
				ray.direction.copy( camera.matrixWorld.getColumnX().negate());
				
				minDistance = CAMERA_COLLISION_DISTANCE_SIDES;
				beginSlowDownDistance = CAMERA_COLLISION_SLOWDOWN_DISTANCE;
				break;
			
			case 2:	
				
				direction = "right";
				ray.origin.copy( wantedCamera.matrixWorld.getPosition());
				ray.direction.copy( camera.matrixWorld.getColumnX());
				
				minDistance = CAMERA_COLLISION_DISTANCE_SIDES;
				beginSlowDownDistance = CAMERA_COLLISION_SLOWDOWN_DISTANCE;
				break;
			
			case 3:	
				
				direction = "down";
				ray.origin.copy( wantedCamera.matrixWorld.getPosition()).y += CAMERA_DOWN_COLLISION_OFFSET;
				ray.direction.copy( camera.matrixWorld.getColumnY().negate());
				
				minDistance = CAMERA_COLLISION_DISTANCE_DOWN;
				beginSlowDownDistance = CAMERA_COLLISION_SLOWDOWN_DISTANCE;
				break;
			
			case 4:
				
				direction = "up";
				ray.origin.copy( wantedCamera.matrixWorld.getPosition());
				ray.direction.copy( camera.matrixWorld.getColumnY());

				minDistance = CAMERA_COLLISION_DISTANCE_UP;
				beginSlowDownDistance = CAMERA_COLLISION_SLOWDOWN_DISTANCE;
				break;
			
		}


		cameraCollisionSwitcher++;
		
		if( cameraCollisionSwitcher > 4 ) {
			
			cameraCollisionSwitcher = 0;
			
		}


		// raycast and modulate camera speed factor

		wantedCameraSpeedFactor[ direction ] = 1;


		var c = world.scene.collisions.rayCastNearest( ray );
		var recalculatedDistance = -1;

		if( c && c.distance !== -1 ) {
			
			recalculatedDistance = c.distance * 0.1;
			
			if( direction !== "down" ) {
				
				if( recalculatedDistance < minDistance + beginSlowDownDistance ) {
					
					if( recalculatedDistance < minDistance ) {
						
						wantedCameraSpeedFactor[ direction ] = 0;
						
					} else {
						
						wantedCameraSpeedFactor[ direction ] = 1 - ( recalculatedDistance - minDistance ) / beginSlowDownDistance;
						
					}
					
				}
				
			}

		}


		// get mouse
		
		var mouseX = shared.mouse.x / shared.screenWidth - 0.5;
		var mouseY = shared.mouse.y / shared.screenHeight - 0.5;


		// special case if collision isn't forward (adjust target and bump up factor so you don't stop)

		if( direction !== "forward" && wantedCameraSpeedFactor[ direction ] < 1 ) {
			
			var adjust = new THREE.Vector3();
			adjust.copy( ray.direction ).negate().multiplyScalar(( 1 - wantedCameraSpeedFactor[ direction ] ) * CAMERA_TARGET_ADJUSTMENT_FACTOR );
			
			if( direction === "left" || direction === "right" ) {
				
				adjust.y = 0;
				
			} else {
				
				adjust.x = 0;
				adjust.z = 0;
				
			}
			
			wantedCameraTarget.position.addSelf( adjust );
			wantedCameraSpeedFactor[ direction ] = Math.max( wantedCameraSpeedFactor[ direction ], 0.3 );

			mouseX *= 0.1;
			mouseY *= 0.1;
		}


		// special case if collision is with ground (no speed attenuation)

		if( direction === "down" && recalculatedDistance < CAMERA_COLLISION_DISTANCE_DOWN ) {
			
			var oldY = wantedCamera.position.y;
			
			wantedCamera.position.y = ray.origin.addSelf( ray.direction.multiplyScalar( recalculatedDistance )).y + CAMERA_LOWEST_Y;
			wantedCameraTarget.position.y += ( wantedCamera.position.y - oldY );
			
		} else if( ray.origin.addSelf( ray.direction.multiplyScalar( recalculatedDistance )).y < CAMERA_LOWEST_Y_NULL_ATTENUATION ) {
			
			wantedCameraSpeedFactor[ direction ] = 1;
			
		}


		// calculate sum of all factors 

		var cameraSpeedFactor = wantedCameraSpeedFactor.forward *
							    wantedCameraSpeedFactor.up *
								wantedCameraSpeedFactor.down *
								wantedCameraSpeedFactor.right *
								wantedCameraSpeedFactor.left;



		// handle up/down (cap lowest, highest)

		if( Math.abs( wantedCameraTarget.position.y - wantedCamera.position.y ) < CAMERA_VERTICAL_LIMIT ) {
			
			wantedCameraTarget.position.y -= mouseY * CAMERA_VERTICAL_FACTOR;
			
		}

		wantedCameraTarget.position.y  = Math.max( wantedCameraTarget.position.y, CAMERA_LOWEST_Y );
		wantedCameraTarget.position.y  = Math.min( wantedCameraTarget.position.y, CAMERA_HIGHEST_Y );


		// handle left/right		

		wantedCameraDirection.sub( wantedCameraTarget.position, wantedCamera.position ).normalize();

		wantedCameraTarget.position.x = wantedCamera.position.x + wantedCameraDirection.x * CAMERA_COLLISION_DISTANCE - wantedCameraDirection.z * CAMERA_HORIZONTAL_FACTOR * mouseX * delta;
		wantedCameraTarget.position.z = wantedCamera.position.z + wantedCameraDirection.z * CAMERA_COLLISION_DISTANCE + wantedCameraDirection.x * CAMERA_HORIZONTAL_FACTOR * mouseX * delta;


		// handle walk
		
		if( progress < CAMERA_START_LIFT ) {
			
			cameraSpeed = CAMERA_FORWARD_SPEED * 0.3;
			shared.cameraSlowDown = true;
			wantedCameraDirection.y = 0;
			wantedCameraDirection.normalize();
			wantedCameraTarget.position.y = wantedCamera.position.y;
			
		} else {
			
			cameraSpeed = CAMERA_FORWARD_SPEED;
			
		}


		// calc camera speed (dependent on hight)
		
		if( !shared.cameraSlowDown )  {
			
			var cameraHightFactor = ( Math.min( Math.max( wantedCamera.position.y, CAMERA_LOWEST_Y ), CAMERA_FORWARD_SPEED_MAX_Y ) - CAMERA_LOWEST_Y ) / ( CAMERA_FORWARD_SPEED_MAX_Y - CAMERA_LOWEST_Y );
			cameraSpeed += ( CAMERA_FORWARD_SPEED_MAX - CAMERA_FORWARD_SPEED ) * cameraHightFactor;
			
		}
		

		// move forward

		wantedCamera.position.addSelf( wantedCameraDirection.multiplyScalar( cameraSpeed * cameraSpeedFactor * delta ));


		// lift off

		if( progress > CAMERA_START_LIFT && progress < CAMERA_END_LIFT ) {

			wantedCamera.position.y += CAMERA_LIFT_SPEED * delta;
			wantedCameraTarget.position.y += CAMERA_LIFT_SPEED * delta * 0.9;
	
		}


		// cap height

		wantedCamera.position.y = Math.max( wantedCamera.position.y, CAMERA_LOWEST_Y );
		wantedCamera.position.y = Math.min( wantedCamera.position.y, CAMERA_HIGHEST_Y );



		// position intertia

		camera.position.x += ( wantedCamera.position.x - camera.position.x ) * CAMERA_INERTIA * delta;
		camera.position.y += ( wantedCamera.position.y - camera.position.y ) * CAMERA_INERTIA * delta;
		camera.position.z += ( wantedCamera.position.z - camera.position.z ) * CAMERA_INERTIA * delta;

		camera.target.position.x += ( wantedCameraTarget.position.x - camera.target.position.x ) * CAMERA_INERTIA * delta;
		camera.target.position.y += ( wantedCameraTarget.position.y - camera.target.position.y ) * CAMERA_INERTIA * delta;
		camera.target.position.z += ( wantedCameraTarget.position.z - camera.target.position.z ) * CAMERA_INERTIA * delta;
		
		
		// roll
		
		var currentCameraZ = camera.matrixWorld.getColumnZ();
		
		wantedCameraDirection.normalize();
		wantedCameraDirection.y = currentCameraZ.y;
		wantedCameraDirection.subSelf( currentCameraZ ).normalize();
		wantedCameraDirection.multiplyScalar( CAMERA_ROLL_FACTOR * delta );
		
		wantedCamera.up.set( 0, 1, 0 );
		wantedCamera.up.subSelf( wantedCameraDirection ).normalize();
		
		camera.up.x += ( wantedCamera.up.x - camera.up.x ) * CAMERA_INERTIA;
		camera.up.y += ( wantedCamera.up.y - camera.up.y ) * CAMERA_INERTIA;
		camera.up.z += ( wantedCamera.up.z - camera.up.z ) * CAMERA_INERTIA;

	}

};

Dunes.prototype = new SequencerItem();
Dunes.prototype.constructor = Dunes;
